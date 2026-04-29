import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatWorkflowResourceMarkdown } from "./tools/workflow-hints.js";
import { registerOpenAiWidgetResources } from './widget-adapter/resource-registry.js';

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
export const registerAllResources = (server: McpServer): void => {
  registerbazhuayuWorkflowResource(server);
  registerOpenAiWidgetResources(server);
};
