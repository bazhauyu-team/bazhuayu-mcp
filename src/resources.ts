import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatWorkflowResourceMarkdown } from "./tools/workflow-hints.js";
import { registerWidgetResources } from './widget-adapter/resource-registry.js';
import type { UiClientPolicy } from './widget-adapter/ui-client-policy.js';

const bazhuayu_WORKFLOW_URI = "bazhuayu://workflow";

/**
 * Static doc: 3-tool pipeline, relevance vs likes, execute_task params, poll/export.
 */
export const registerbazhuayuWorkflowResource = (server: McpServer): void => {
  server.registerResource(
    "bazhuayu-workflow",
    bazhuayu_WORKFLOW_URI,
    {
      title: "bazhuayu MCP workflow",
      description: "3-tool workflow and parameter rules",
      mimeType: "text/markdown"
    },
    async () => ({
      contents: [
        {
          uri: bazhuayu_WORKFLOW_URI,
          text: formatWorkflowResourceMarkdown()
        }
      ]
    })
  );
};

/**
 * Register all MCP resources
 */
export const registerAllResources = (
  server: McpServer,
  options: {
    uiPolicy?: UiClientPolicy;
    /** @deprecated Use uiPolicy. */
    uiMetaEnabled?: boolean;
  } = {}
): void => {
  registerbazhuayuWorkflowResource(server);
  registerWidgetResources(server, {
    uiPolicy: options.uiPolicy,
    uiMetaEnabled: options.uiMetaEnabled
  });
};
