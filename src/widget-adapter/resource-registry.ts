import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AppConfig } from '../config/app-config.js';

export const SEARCH_TEMPLATES_WIDGET_URI = 'ui://widget/search-templates.html';
export const SEARCH_TASKS_WIDGET_URI = 'ui://widget/search-tasks.html';
const WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';
const DEFAULT_WIDGET_RESOURCE_DOMAINS = [
  'https://image.bazhuayu.com',
  'https://op.image.skieer.com'
];

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildWidgetHtml(input: {
  title: string;
  entrypoint: 'search-templates' | 'search-tasks';
}): string {
  const publicBaseUrl = trimTrailingSlash(AppConfig.getServerConfig().publicBaseUrl);
  const stylesheetUrl = `${publicBaseUrl}/openai-app/styles.css`;
  const scriptUrl = `${publicBaseUrl}/openai-app/${input.entrypoint}.js`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
    <link rel="stylesheet" href="${stylesheetUrl}" />
  </head>
  <body>
    <div id="root"></div>
    <script>window.__bazhuayu_WIDGET_KIND__ = "${input.entrypoint}";</script>
    <script type="module" src="${scriptUrl}"></script>
  </body>
</html>`;
}

function getWidgetCspMeta() {
  const publicBaseUrl = trimTrailingSlash(AppConfig.getServerConfig().publicBaseUrl);
  const resourceDomains = Array.from(new Set([publicBaseUrl, ...DEFAULT_WIDGET_RESOURCE_DOMAINS]));
  const csp = {
    connect_domains: [publicBaseUrl],
    resource_domains: resourceDomains
  };

  return {
    ui: {
      prefersBorder: true,
      domain: publicBaseUrl,
      csp
    },
    'openai/widgetPrefersBorder': true,
    'openai/widgetDomain': publicBaseUrl,
    'openai/widgetCSP': csp
  };
}

function getTemplateWidgetDescription(): string {
  return 'This widget already shows the full template cards, pricing, tags, and run mode hints. Do not repeat the cards or metadata. Reply in Chinese with a 100-200 character summary only.';
}

function getTaskWidgetDescription(): string {
  return 'This widget already shows the full task list and status. Do not repeat the table rows. Reply in Chinese with a 100-200 character summary only.';
}

export function registerOpenAiWidgetResources(server: McpServer): void {
  server.registerResource(
    'search-templates-widget',
    SEARCH_TEMPLATES_WIDGET_URI,
    {
      title: 'Template search widget',
      description: 'Visual template search results for OpenAI Apps SDK',
      mimeType: WIDGET_MIME_TYPE
    },
    async () => ({
      contents: [
        {
          uri: SEARCH_TEMPLATES_WIDGET_URI,
          mimeType: WIDGET_MIME_TYPE,
          text: buildWidgetHtml({
            title: 'Template Search',
            entrypoint: 'search-templates'
          }),
          _meta: {
            'openai/widgetDescription': getTemplateWidgetDescription(),
            ...getWidgetCspMeta()
          }
        }
      ]
    })
  );

  server.registerResource(
    'search-tasks-widget',
    SEARCH_TASKS_WIDGET_URI,
    {
      title: 'Task search widget',
      description: 'Visual task list results for OpenAI Apps SDK',
      mimeType: WIDGET_MIME_TYPE
    },
    async () => ({
      contents: [
        {
          uri: SEARCH_TASKS_WIDGET_URI,
          mimeType: WIDGET_MIME_TYPE,
          text: buildWidgetHtml({
            title: 'Task Search',
            entrypoint: 'search-tasks'
          }),
          _meta: {
            'openai/widgetDescription': getTaskWidgetDescription(),
            ...getWidgetCspMeta()
          }
        }
      ]
    })
  );
}
