import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CreateTaskRequestHandlerExtra,
  TaskRequestHandlerExtra
} from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { z } from 'zod';
import { bazhuayuApi } from '../api/bazhuayu.js';
import { AppConfig } from '../config/app-config.js';
import {
  ToolDefinition,
  ToolTaskRegistration
} from './tool-definition.js';
import {
  handleError,
  checkAuth,
  toMcpResponse,
  createSuccessResponse
} from './middleware.js';
import { emitMcpLog } from '../mcp/logging-capability.js';
import { Logger } from '../utils/logger.js';

function isApiResponseLike(value: unknown): value is { success: boolean } {
  return (
    !!value &&
    typeof value === 'object' &&
    'success' in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).success === 'boolean'
  );
}

/**
 * Factory function type for creating API instances
 * Allows lazy creation of API instances with fresh tokens
 */
export type ApiFactory = () => Promise<bazhuayuApi | undefined>;

type TaskOperationName = 'createTask' | 'getTask' | 'getTaskResult';

interface ToolExecutionLogSink {
  start(tool: ToolDefinition, extraMeta?: Record<string, unknown>): Promise<void>;
  success(tool: ToolDefinition, extraMeta?: Record<string, unknown>): Promise<void>;
  authRejected(tool: ToolDefinition, extraMeta?: Record<string, unknown>): Promise<void>;
  failure(tool: ToolDefinition, error: unknown, extraMeta?: Record<string, unknown>): Promise<void>;
}

const NOOP_TOOL_LOG_SINK: ToolExecutionLogSink = {
  start: async () => {},
  success: async () => {},
  authRejected: async () => {},
  failure: async () => {}
};

class TaskOperationAuthError extends Error {
  constructor(readonly authError: Awaited<ReturnType<typeof checkAuth>>) {
    super(authError?.error?.message ?? 'Authentication required. Please provide a valid Bearer token.');
    this.name = 'TaskOperationAuthError';
  }
}

function getToolConfig(tool: ToolDefinition) {
  const config: any = {
    title: tool.title,
    description: tool.description,
    inputSchema: getSchemaShape(tool.inputSchema),
    annotations: tool.annotations
  };

  if (tool.uiBinding) {
    const outputTemplate = tool.uiBinding.outputTemplate ?? tool.uiBinding.resourceUri;
    config._meta = {
      ui: {
        resourceUri: outputTemplate
      },
      'openai/outputTemplate': outputTemplate,
      'openai/widgetAccessible': tool.uiBinding.widgetAccessible ?? false,
      'openai/toolInvocation/invoking':
        tool.uiBinding.invokingText ?? `${tool.title} is loading...`,
      'openai/toolInvocation/invoked':
        tool.uiBinding.invokedText ?? `${tool.title} is ready.`
    };
  };

  return config;
}

function getTaskOperationMeta(operation: TaskOperationName) {
  return {
    taskOperation: operation
  };
}

async function emitToolStartLog(
  server: McpServer,
  tool: ToolDefinition,
  extraMeta?: Record<string, unknown>
): Promise<void> {
  await emitMcpLog(server, {
    level: 'info',
    logger: 'bazhuayu.mcp.tool',
    data: `Starting tool: ${tool.name}`
  }, {
    meta: {
      toolName: tool.name,
      ...extraMeta
    }
  });
}

async function emitToolSuccessLog(
  server: McpServer,
  tool: ToolDefinition,
  extraMeta?: Record<string, unknown>
): Promise<void> {
  await emitMcpLog(server, {
    level: 'info',
    logger: 'bazhuayu.mcp.tool',
    data: `Tool succeeded: ${tool.name}`
  }, {
    meta: {
      toolName: tool.name,
      ...extraMeta
    }
  });
}

async function emitToolAuthRejectedLog(
  server: McpServer,
  tool: ToolDefinition,
  extraMeta?: Record<string, unknown>
): Promise<void> {
  await emitMcpLog(server, {
    level: 'warning',
    logger: 'bazhuayu.mcp.tool',
    data: `Tool rejected by authentication guard: ${tool.name}`
  }, {
    meta: {
      toolName: tool.name,
      ...extraMeta
    }
  });
}

async function emitToolFailureLog(
  server: McpServer,
  tool: ToolDefinition,
  error: unknown,
  extraMeta?: Record<string, unknown>
): Promise<void> {
  await emitMcpLog(server, {
    level: 'error',
    logger: 'bazhuayu.mcp.tool',
    data: `Tool failed: ${tool.name}${error instanceof Error ? ` - ${error.message}` : ''}`
  }, {
    meta: {
      toolName: tool.name,
      errorName: error instanceof Error ? error.name : undefined,
      ...extraMeta
    }
  });
}

function createMcpToolLogSink(server: McpServer): ToolExecutionLogSink {
  return {
    start: (tool, extraMeta) => emitToolStartLog(server, tool, extraMeta),
    success: (tool, extraMeta) => emitToolSuccessLog(server, tool, extraMeta),
    authRejected: (tool, extraMeta) => emitToolAuthRejectedLog(server, tool, extraMeta),
    failure: (tool, error, extraMeta) => emitToolFailureLog(server, tool, error, extraMeta)
  };
}

function createDirectToolLogSink(): ToolExecutionLogSink {
  const log = Logger.createNamedLogger('bazhuayu.mcp.tool');
  const toOptions = (
    tool: ToolDefinition,
    extraMeta?: Record<string, unknown>
  ) => ({
    toolName: tool.name,
    meta: extraMeta
  });

  return {
    start: async (tool, extraMeta) => {
      log.info(`Starting tool: ${tool.name}`, toOptions(tool, extraMeta));
    },
    success: async (tool, extraMeta) => {
      log.info(`Tool succeeded: ${tool.name}`, toOptions(tool, extraMeta));
    },
    authRejected: async (tool, extraMeta) => {
      log.warn(`Tool rejected by authentication guard: ${tool.name}`, toOptions(tool, extraMeta));
    },
    failure: async (tool, error, extraMeta) => {
      const message = `Tool failed: ${tool.name}${error instanceof Error ? ` - ${error.message}` : ''}`;
      const options = {
        ...toOptions(tool, extraMeta),
        meta: {
          ...(extraMeta ?? {}),
          errorName: error instanceof Error ? error.name : undefined
        }
      };

      if (error instanceof Error) {
        log.logError(message, error, options);
        return;
      }

      log.error(message, options);
    }
  };
}

/**
 * Create a wrapped handler with all middleware applied
 * Uses factory function for lazy API instance creation
 */
function createWrappedHandler<TInput, TOutput>(
  server: McpServer,
  tool: ToolDefinition<TInput, TOutput>,
  getApi: ApiFactory
) {
  return async (args: any): Promise<any> => {
    return executeToolWithMiddleware(tool, getApi, args, {
      logSink: createMcpToolLogSink(server)
    });
  };
}

export async function executeToolWithMiddleware<TInput, TOutput>(
  tool: ToolDefinition<TInput, TOutput>,
  getApi: ApiFactory,
  args: unknown,
  options?: {
    logSink?: ToolExecutionLogSink;
  }
): Promise<any> {
    const logSink = options?.logSink ?? NOOP_TOOL_LOG_SINK;
    // Create API instance on each request for fresh token
    const api = await getApi();

    try {
      await logSink.start(tool);

      // Middleware 1: Authentication (if required)
      if (tool.requiresAuth) {
        const authError = await checkAuth(api);
        if (authError) {
          await logSink.authRejected(tool);
          return toMcpResponse(authError);
        }
      }

      // Middleware 2: Input validation
      let validInput: TInput;
      try {
        validInput = tool.inputSchema.parse(args);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const path = (e: z.ZodIssue) =>
            e.path.length > 0 ? `${e.path.join('.')}: ` : '';
          throw new Error(
            `Validation error: ${error.issues.map((e) => `${path(e)}${e.message}`).join('; ')}`
          );
        }
        throw error;
      }

      // Execute the actual handler
      const result = await tool.handler(validInput, getApi);
      const presentedResult =
        tool.uiBinding && !isApiResponseLike(result) && !('content' in (result as Record<string, unknown>))
          ? tool.uiBinding.presenter(result)
          : tool.uiBinding && isApiResponseLike(result)
            ? tool.uiBinding.presenter(result as TOutput)
            : result;

      if (isApiResponseLike(presentedResult)) {
        if (presentedResult.success) {
          await logSink.success(tool, {
            success: true
          });
        } else {
          await logSink.failure(tool, undefined, {
            success: false
          });
        }
        return toMcpResponse(presentedResult);
      }

      if (!!presentedResult && typeof presentedResult === 'object' && 'content' in (presentedResult as Record<string, unknown>)) {
        if ((presentedResult as { isError?: boolean }).isError) {
          await logSink.failure(tool, undefined, {
            success: false
          });
        } else {
          await logSink.success(tool, {
            success: true
          });
        }
        return toMcpResponse(presentedResult as any);
      }

      // Return success response
      await logSink.success(tool);
      return toMcpResponse(await createSuccessResponse(presentedResult, api));

    } catch (error) {
      await logSink.failure(tool, error);

      // Handle error
      const errorResponse = await handleError(error, api);
      return toMcpResponse(errorResponse);
    }
}

export function createDefaultDirectToolLogSink(): ToolExecutionLogSink {
  return createDirectToolLogSink();
}

function createWrappedTaskOperationHandler<TInput, TExtra, TResult>(
  server: McpServer,
  tool: ToolDefinition<TInput>,
  getApi: ApiFactory,
  operation: TaskOperationName,
  handler: (args: TInput, extra: TExtra) => Promise<TResult>,
  options: {
    errorMode: 'throw' | 'mcpResponse';
  }
) {
  return async (
    args: TInput,
    extra: TExtra
  ): Promise<TResult> => {
    // registerToolTask already delegates input validation to the MCP SDK before
    // invoking the wrapped task handlers, so this path should not re-parse args.
    const api = await getApi();

    try {
      await emitToolStartLog(server, tool, getTaskOperationMeta(operation));

      if (tool.requiresAuth) {
        const authError = await checkAuth(api);
        if (authError) {
          await emitToolAuthRejectedLog(server, tool, getTaskOperationMeta(operation));
          throw new TaskOperationAuthError(authError);
        }
      }

      const result = await handler(args, extra);
      await emitToolSuccessLog(server, tool, getTaskOperationMeta(operation));
      return result;
    } catch (error) {
      if (error instanceof TaskOperationAuthError) {
        if (options.errorMode === 'mcpResponse') {
          return toMcpResponse(error.authError!) as TResult;
        }

        throw new Error(error.message);
      }

      await emitToolFailureLog(server, tool, error, getTaskOperationMeta(operation));
      const errorResponse = await handleError(error, api);

      if (options.errorMode === 'mcpResponse') {
        return toMcpResponse(errorResponse) as TResult;
      }

      throw new Error(errorResponse.error?.message ?? 'Unknown error');
    }
  };
}

function createWrappedTaskHandler<TInput>(
  server: McpServer,
  tool: ToolDefinition<TInput>,
  getApi: ApiFactory,
  taskRegistration: ToolTaskRegistration<TInput>
) {
  return {
    createTask: createWrappedTaskOperationHandler(
      server,
      tool,
      getApi,
      'createTask',
      (args, extra: CreateTaskRequestHandlerExtra) => taskRegistration.handler.createTask(args, getApi, extra),
      {
        errorMode: 'throw'
      }
    ),
    getTask: createWrappedTaskOperationHandler(
      server,
      tool,
      getApi,
      'getTask',
      (args, extra: TaskRequestHandlerExtra) => taskRegistration.handler.getTask(args, getApi, extra),
      {
        errorMode: 'throw'
      }
    ),
    getTaskResult: createWrappedTaskOperationHandler(
      server,
      tool,
      getApi,
      'getTaskResult',
      (args, extra: TaskRequestHandlerExtra) => taskRegistration.handler.getTaskResult(args, getApi, extra),
      {
        errorMode: 'mcpResponse'
      }
    )
  };
}

/**
 * Register a single tool on the MCP server
 * Now accepts a factory function for lazy API instance creation
 */
export function registerTool(
  server: McpServer,
  tool: ToolDefinition,
  getApi: ApiFactory
): void {
  server.registerTool(
    tool.name,
    getToolConfig(tool),
    createWrappedHandler(server, tool, getApi)
  );
}

export function registerToolTask(
  server: McpServer,
  tool: ToolDefinition,
  getApi: ApiFactory
): void {
  if (!tool.taskRegistration) {
    throw new Error(`Tool ${tool.name} is missing task registration metadata.`);
  }

  server.experimental.tasks.registerToolTask(
    tool.name,
    {
      ...getToolConfig(tool),
      execution: tool.taskRegistration.execution
    },
    createWrappedTaskHandler(server, tool, getApi, tool.taskRegistration)
  );
}

/**
 * Register all tools in one shot
 * Uses factory function pattern for lazy API instance creation
 */
export function registerAllTools(
  server: McpServer,
  tools: ToolDefinition[],
  getApi: ApiFactory
): void {
  const taskEnabled = AppConfig.getTaskConfig().enabled;
  for (const tool of tools) {
    if (tool.taskRegistration && taskEnabled) {
      registerToolTask(server, tool, getApi);
      continue;
    }

    registerTool(server, tool, getApi);
  }
}

/**
 * Helper to get input schema shape for MCP registration
 * Handles both z.object() and other Zod schemas
 */
function getSchemaShape(schema: z.ZodSchema): any {
  const anySchema = schema as any;
  const def = anySchema._def;

  // z.preprocess / ZodEffects: inner object schema is in _def.schema (see Zod 3)
  if (def?.typeName === 'ZodEffects' && def.schema) {
    return getSchemaShape(def.schema);
  }

  if (def && def.shape) {
    if (typeof def.shape === 'function') {
      return def.shape();
    }
    return def.shape;
  }

  return {};
}
