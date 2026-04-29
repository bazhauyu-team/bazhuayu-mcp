import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ToolUiBinding } from './tool-ui-contract.js';

function normalizeStructuredContent(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {
    value
  };
}

export function createWidgetToolResult(input: {
  binding: Pick<ToolUiBinding, 'resourceUri' | 'outputTemplate' | 'widgetAccessible'>;
  text: string;
  structuredContent?: unknown;
  widgetData?: Record<string, unknown>;
  isError?: boolean;
}): CallToolResult {
  const resourceUri = input.binding.outputTemplate ?? input.binding.resourceUri;

  return {
    content: [
      {
        type: 'text',
        text: input.text
      }
    ],
    ...(normalizeStructuredContent(input.structuredContent) !== undefined
      ? { structuredContent: normalizeStructuredContent(input.structuredContent) }
      : {}),
    _meta: {
      ui: {
        resourceUri
      },
      'openai/outputTemplate': resourceUri,
      'openai/resultCanProduceWidget': true,
      'openai/widgetAccessible': input.binding.widgetAccessible ?? false,
      ...(input.widgetData ?? {})
    },
    ...(input.isError ? { isError: true } : {})
  };
}
