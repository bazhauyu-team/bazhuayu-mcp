import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';
import ts from 'typescript';

process.env.CLIENTAPI_BASE_URL = process.env.CLIENTAPI_BASE_URL || 'https://client-api.example.com';
process.env.OFFICIAL_SITE_URL = process.env.OFFICIAL_SITE_URL || 'https://bazhuayu.example.com';
process.env.PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://widgets.example.com';
process.env.LOG_ENABLE_CONSOLE = 'false';
process.env.LOG_ENABLE_FILE = 'false';

const { executeToolWithMiddleware } = await import('../dist/tools/tool-registry.js');
const { registerAllResources } = await import('../dist/resources.js');
const { presentSearchTemplatesResult } = await import(
  '../dist/widget-adapter/presenters/search-templates.presenter.js'
);
const { presentSearchTasksResult } = await import(
  '../dist/widget-adapter/presenters/search-tasks.presenter.js'
);

test('root build scripts treat widget code as a separate web project', () => {
  const rootPackage = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
  );

  assert.match(rootPackage.scripts.build, /build:web/);
  assert.match(rootPackage.scripts['build:web'], /--prefix web/);
  assert.equal(fs.existsSync(path.resolve(process.cwd(), 'web', 'package.json')), true);
});

test('web build config keeps widget env loading isolated from the server project root', () => {
  const viteConfig = fs.readFileSync(path.resolve(process.cwd(), 'web', 'vite.config.ts'), 'utf8');

  assert.match(viteConfig, /envDir:\s*__dirname/);
  assert.doesNotMatch(viteConfig, /envDir:\s*path\.resolve\(__dirname,\s*['"]\.\.['"]\)/);
});

test('server-side widget adapter lives outside the web project under a neutral adapter directory', () => {
  assert.equal(fs.existsSync(path.resolve(process.cwd(), 'src', 'widget-adapter')), true);
  assert.equal(fs.existsSync(path.resolve(process.cwd(), 'src', 'openai-app')), false);
  assert.equal(
    fs.existsSync(path.resolve(process.cwd(), 'src', 'widget-adapter', 'ui-result.ts')),
    true
  );
});

test('workflow tools do not patch widget card metadata directly', () => {
  const workflowToolsSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src', 'tools', 'workflow-tools.ts'),
    'utf8'
  );

  assert.doesNotMatch(workflowToolsSource, /enrichSearchTemplatesPresentation/);
  assert.doesNotMatch(workflowToolsSource, /mergeTemplateSelectionMetadata/);
  assert.doesNotMatch(workflowToolsSource, /_meta:\s*\{/);
  assert.doesNotMatch(workflowToolsSource, /\.cards\b/);
});

test('Dockerfile copies built widget assets into the runtime image', () => {
  const dockerfile = fs.readFileSync(path.resolve(process.cwd(), 'Dockerfile'), 'utf8');

  assert.match(
    dockerfile,
    /COPY --from=builder --chown=nextjs:nodejs \/app\/web\/dist \.\/web\/dist/
  );
});

test('CORS middleware is registered before widget static assets so module scripts can load in ChatGPT sandbox', () => {
  const indexSource = fs.readFileSync(path.resolve(process.cwd(), 'src', 'index.ts'), 'utf8');
  const corsIndex = indexSource.indexOf('app.use(cors({');
  const widgetStaticIndex = indexSource.indexOf("app.use('/openai-app', express.static");

  assert.notEqual(corsIndex, -1);
  assert.notEqual(widgetStaticIndex, -1);
  assert.ok(corsIndex < widgetStaticIndex, 'cors() should be registered before /openai-app static assets');
});

test('widget CSP allows template images from bazhuayu image CDNs', async () => {
  const registered = [];
  registerAllResources({
    registerResource(name, uri, meta, handler) {
      registered.push({ name, uri, meta, handler });
    }
  });

  const searchTemplatesResource = registered.find((resource) => resource.name === 'search-templates-widget');
  assert.ok(searchTemplatesResource);

  const response = await searchTemplatesResource.handler();
  assert.equal(searchTemplatesResource.meta.mimeType, 'text/html;profile=mcp-app');
  assert.equal(response.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.equal(response.contents[0]._meta.ui.prefersBorder, true);
  assert.equal(response.contents[0]._meta['openai/widgetPrefersBorder'], true);

  const csp = response.contents[0]._meta.ui.csp;

  assert.ok(csp.resource_domains.includes('https://image.bazhuayu.com'));
  assert.ok(csp.resource_domains.includes('https://op.image.skieer.com'));
  assert.deepEqual(response.contents[0]._meta['openai/widgetCSP'], csp);
});

test('search templates bootstrap uses a waiting-state payload until search template data arrives', () => {
  return withBootstrapModule((bootstrap) => {
    withWindowState(undefined, undefined, () => {
      assert.deepEqual(bootstrap.getTemplateWidgetPayload(), {
        isLoading: true,
        selectedTemplateRef: null,
        generatedParameterSummary: '',
        generatedExecuteTaskSuggestion: '',
        nextStepHint: '',
        cards: [],
        banner: null,
        pagination: {
          page: 1,
          pageSize: 0,
          total: 0
        },
        structuredContent: {
          recommendedTemplate: null
        }
      });
    });
  });
});

test('search templates presenter carries selection metadata and keeps heavy schema out of widget cards', () => {
  const response = presentSearchTemplatesResult(
    {
      success: true,
      queryMode: 'keyword',
      selectedTemplateRef: {
        templateId: 42,
        templateName: 'google_maps_places',
        displayName: 'Google Maps Places'
      },
      generatedParameterSummary: 'Keyword: coffee shops in Seattle',
      generatedExecuteTaskSuggestion: 'Execute this template with the detected keyword.',
      nextStepHint: 'Review the selected template, then run the task.',
      templates: [
        {
          templateName: 'google_maps_places',
          displayName: 'Google Maps Places',
          selectable: true,
          selectionMode: 'execute_task',
          templateRef: {
            templateId: 42,
            templateName: 'google_maps_places',
            displayName: 'Google Maps Places'
          },
          supportsCloudScraping: true,
          downloadUrl: 'https://bazhuayu.example.com/download',
          inputSchema: [{ field: 'keyword', type: 'string[]' }],
          outputSchema: [{ field: 'name', type: 'string' }]
        }
      ]
    },
    {
      resourceUri: 'ui://widget/search-templates.html'
    }
  );

  assert.equal(response.structuredContent.selectedTemplateRef.templateId, 42);
  assert.equal(response.structuredContent.generatedParameterSummary, 'Keyword: coffee shops in Seattle');
  assert.equal(
    response.structuredContent.generatedExecuteTaskSuggestion,
    'Execute this template with the detected keyword.'
  );
  assert.equal(
    response.structuredContent.nextStepHint,
    'Review the selected template, then run the task.'
  );
  assert.equal(response.structuredContent.templates[0].selectionMode, 'execute_task');
  assert.equal(response.structuredContent.templates[0].templateRef.templateId, 42);
  assert.equal('inputSchema' in response.structuredContent.templates[0], false);
  assert.equal('outputSchema' in response.structuredContent.templates[0], false);
  assert.deepEqual(response.structuredContent.templates[0], {
    templateName: 'google_maps_places',
    displayName: 'Google Maps Places',
    selectionMode: 'execute_task',
    templateRef: {
      templateId: 42,
      templateName: 'google_maps_places',
      displayName: 'Google Maps Places'
    }
  });
  assert.equal(response.structuredContent.widgetRendered, true);
  assert.equal(response._meta.selectedTemplateRef.templateId, 42);
  assert.equal(response._meta.generatedParameterSummary, 'Keyword: coffee shops in Seattle');
  assert.equal(
    response._meta.generatedExecuteTaskSuggestion,
    'Execute this template with the detected keyword.'
  );
  assert.equal(response._meta.nextStepHint, 'Review the selected template, then run the task.');
  assert.equal(
    response._meta.useTemplatePromptTemplate,
    'I want to use the [{templateName}] template to run a collection. Please help me prepare the required parameters.'
  );
  assert.equal(response._meta['openai/widgetAccessible'], true);
  assert.equal(response._meta.cards[0].selectionMode, 'execute_task');
  assert.equal(response._meta.cards[0].templateRef.templateId, 42);
  assert.equal(
    response._meta.cards[0].downloadUrl,
    'https://bazhuayu.example.com/download'
  );
  assert.equal('inputSchema' in response._meta.cards[0], false);
  assert.equal('outputSchema' in response._meta.cards[0], false);
});

test('search templates bootstrap normalizes the full Task 2 selection contract from tool output metadata', () => {
  return withBootstrapModule((bootstrap) => {
    withWindowState(
      {
        structuredContent: {
          recommendedTemplate: {
            displayName: 'Google Maps Places',
            templateName: 'google_maps_places',
            reason: 'High relevance'
          }
        },
        _meta: {
          cards: [
            {
              templateName: 'google_maps_places',
              displayName: 'Google Maps Places',
              selectable: true,
              selectionMode: 'execute_task',
              templateRef: {
                templateId: 42,
                templateName: 'google_maps_places',
                displayName: 'Google Maps Places'
              },
              kindLabels: ['Maps'],
              downloadUrl: 'https://bazhuayu.example.com/download',
              inputSchema: [{ field: 'keyword', type: 'string[]' }],
              outputSchema: [{ field: 'name', type: 'string' }]
            }
          ],
          selectedTemplateRef: {
            templateId: 42,
            templateName: 'google_maps_places',
            displayName: 'Google Maps Places'
          },
          generatedParameterSummary: 'Keyword: coffee shops in Seattle',
          generatedExecuteTaskSuggestion: 'Execute this template with the detected keyword.',
          nextStepHint: 'Review the selected template, then run the task.',
          pagination: {
            page: 2,
            pageSize: 10,
            total: 17
          }
        }
      },
      undefined,
      () => {
        assert.deepEqual(bootstrap.getTemplateWidgetPayload(), {
          isLoading: false,
          selectedTemplateRef: {
            templateId: 42,
            templateName: 'google_maps_places',
            displayName: 'Google Maps Places'
          },
          generatedParameterSummary: 'Keyword: coffee shops in Seattle',
          generatedExecuteTaskSuggestion: 'Execute this template with the detected keyword.',
          nextStepHint: 'Review the selected template, then run the task.',
          cards: [
            {
              templateName: 'google_maps_places',
              displayName: 'Google Maps Places',
              shortDescription: undefined,
              imageUrl: undefined,
              selectable: true,
              selectionMode: 'execute_task',
              templateRef: {
                templateId: 42,
                templateName: 'google_maps_places',
                displayName: 'Google Maps Places'
              },
              supportsCloudScraping: undefined,
              runOnLabel: undefined,
              popularityLikes: undefined,
              kindLabels: ['Maps'],
              priceLabel: undefined,
              lastModifiedLabel: undefined,
              iconKey: undefined,
              note: undefined,
              downloadUrl: 'https://bazhuayu.example.com/download',
              sourceOptions: undefined,
              inputSchema: [{ field: 'keyword', type: 'string[]' }],
              outputSchema: [{ field: 'name', type: 'string' }]
            }
          ],
          banner: null,
          pagination: {
            page: 2,
            pageSize: 10,
            total: 17
          },
          structuredContent: {
            recommendedTemplate: {
              displayName: 'Google Maps Places',
              templateName: 'google_maps_places',
              reason: 'High relevance'
            }
          }
        });
      }
    );
  });
});

test('search templates bootstrap falls back to a safe degraded payload when tool output exists but template normalization fails', () => {
  return withBootstrapModule((bootstrap) => {
    withWindowState(
      {
        structuredContent: {
          selectedTemplateRef: {
            templateId: 42
          },
          generatedParameterSummary: 'partial',
          generatedExecuteTaskSuggestion: 'suggestion',
          nextStepHint: 'hint'
        },
        _meta: {
          cards: {
            invalid: true
          }
        }
      },
      undefined,
      () => {
        assert.deepEqual(bootstrap.getTemplateWidgetPayload(), {
          isLoading: false,
          selectedTemplateRef: {
            templateId: 42,
            templateName: undefined,
            displayName: undefined
          },
          generatedParameterSummary: 'partial',
          generatedExecuteTaskSuggestion: 'suggestion',
          nextStepHint: 'hint',
          cards: [],
          banner: null,
          pagination: {
            page: 1,
            pageSize: 0,
            total: 0
          },
          structuredContent: {
            recommendedTemplate: null,
            selectedTemplateRef: {
              templateId: 42
            },
            generatedParameterSummary: 'partial',
            generatedExecuteTaskSuggestion: 'suggestion',
            nextStepHint: 'hint'
          }
        });
      }
    );
  });
});

test('search templates bootstrap falls back from structuredContent when metadata omits selection guidance fields', () => {
  return withBootstrapModule((bootstrap) => {
    withWindowState(
      {
        structuredContent: {
          selectedTemplateRef: {
            templateId: 55,
            templateName: 'meta-fallback',
            displayName: 'Meta Fallback'
          },
          generatedParameterSummary: 'summary from structured content',
          generatedExecuteTaskSuggestion: 'suggestion from structured content',
          nextStepHint: 'hint from structured content'
        },
        _meta: {
          cards: [
            {
              templateName: 'meta-fallback',
              displayName: 'Meta Fallback',
              selectable: true,
              selectionMode: 'execute_task'
            }
          ]
        }
      },
      undefined,
      () => {
        assert.deepEqual(bootstrap.getTemplateWidgetPayload(), {
          isLoading: false,
          selectedTemplateRef: {
            templateId: 55,
            templateName: 'meta-fallback',
            displayName: 'Meta Fallback'
          },
          generatedParameterSummary: 'summary from structured content',
          generatedExecuteTaskSuggestion: 'suggestion from structured content',
          nextStepHint: 'hint from structured content',
          cards: [
            {
              templateName: 'meta-fallback',
              displayName: 'Meta Fallback',
              shortDescription: undefined,
              imageUrl: undefined,
              selectable: true,
              selectionMode: 'execute_task',
              templateRef: null,
              supportsCloudScraping: undefined,
              runOnLabel: undefined,
              popularityLikes: undefined,
              kindLabels: [],
              priceLabel: undefined,
              lastModifiedLabel: undefined,
              iconKey: undefined,
              note: undefined,
              downloadUrl: undefined,
              sourceOptions: undefined,
              inputSchema: undefined,
              outputSchema: undefined
            }
          ],
          banner: null,
          pagination: {
            page: 1,
            pageSize: 1,
            total: 1
          },
          structuredContent: {
            recommendedTemplate: null
          }
        });
      }
    );
  });
});

test('search templates bootstrap ignores malformed metadata selection refs and preserves structuredContent fallback', () => {
  return withBootstrapModule((bootstrap) => {
    withWindowState(
      {
        structuredContent: {
          selectedTemplateRef: {
            templateId: 77,
            templateName: 'structured-template',
            displayName: 'Structured Template'
          }
        },
        _meta: {
          cards: [
            {
              templateName: 'structured-template',
              displayName: 'Structured Template',
              selectable: true,
              selectionMode: 'execute_task'
            }
          ],
          selectedTemplateRef: {}
        }
      },
      undefined,
      () => {
        const payload = bootstrap.getTemplateWidgetPayload();
        assert.deepEqual(payload.selectedTemplateRef, {
          templateId: 77,
          templateName: 'structured-template',
          displayName: 'Structured Template'
        });
      }
    );
  });
});

test('search templates bootstrap preserves explicit empty-string metadata guidance fields', () => {
  return withBootstrapModule((bootstrap) => {
    withWindowState(
      {
        structuredContent: {
          generatedParameterSummary: 'structured summary',
          generatedExecuteTaskSuggestion: 'structured suggestion',
          nextStepHint: 'structured hint'
        },
        _meta: {
          cards: [],
          generatedParameterSummary: '',
          generatedExecuteTaskSuggestion: '',
          nextStepHint: ''
        }
      },
      undefined,
      () => {
        const payload = bootstrap.getTemplateWidgetPayload();
        assert.equal(payload.generatedParameterSummary, '');
        assert.equal(payload.generatedExecuteTaskSuggestion, '');
        assert.equal(payload.nextStepHint, '');
      }
    );
  });
});

test('search templates widget sends a follow-up message for cloud template selection', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTemplatesApp.tsx'),
    'utf8'
  );

  assert.match(widgetSource, /template-button--compact/);
  assert.match(widgetSource, /'Use'/);
  assert.match(widgetSource, /ui\/message/);
  assert.match(widgetSource, /role:\s*'user'/);
  assert.doesNotMatch(widgetSource, /sendFollowUpMessage/);
  assert.doesNotMatch(widgetSource, /scrollToBottom:\s*true/);
  assert.doesNotMatch(widgetSource, /callTool/);
  assert.doesNotMatch(widgetSource, /execute_task/);
  assert.doesNotMatch(widgetSource, /validateOnly:\s*true/);
  assert.match(widgetSource, /templateName/);
  assert.match(widgetSource, /useTemplatePromptTemplate/);
  assert.match(widgetSource, /replace\('\{templateName\}', templateName\)/);
  assert.doesNotMatch(widgetSource, /使用 \[\$\{templateName\}\] 模板采集数据/);
  assert.doesNotMatch(widgetSource, /What parameters do I need to provide/);
  assert.match(widgetSource, /selectionMode === 'local_only'/);
  assert.doesNotMatch(widgetSource, /Template Setup/);
  assert.doesNotMatch(widgetSource, /generatedExecuteTaskSuggestion/);
  assert.doesNotMatch(widgetSource, /card\.note/);
  assert.doesNotMatch(widgetSource, /Sent to conversation/);
  assert.doesNotMatch(widgetSource, /selectedPrompt/);
  assert.doesNotMatch(widgetSource, /setSelectedPrompt/);
});

test('search templates widget binds template image and short description into cards', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTemplatesApp.tsx'),
    'utf8'
  );

  assert.match(widgetSource, /card\.imageUrl/);
  assert.match(widgetSource, /<img/);
  assert.match(widgetSource, /template-card__image/);
  assert.match(widgetSource, /template-card__description/);
  assert.match(widgetSource, /card\.shortDescription/);
});

test('search templates widget keeps the use action beside the title and description below the icon row', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTemplatesApp.tsx'),
    'utf8'
  );

  const headerIndex = widgetSource.indexOf('template-card__header');
  const titleRowIndex = widgetSource.indexOf('template-card__title-row');
  const actionStackIndex = widgetSource.indexOf('template-card__action-stack');
  const buttonIndex = widgetSource.indexOf('template-button--compact');
  const envIndex = widgetSource.indexOf('template-run-icons');
  const descriptionIndex = widgetSource.indexOf('template-card__description');

  assert.ok(headerIndex >= 0);
  assert.ok(titleRowIndex > headerIndex);
  assert.ok(actionStackIndex > titleRowIndex);
  assert.ok(buttonIndex > actionStackIndex);
  assert.ok(buttonIndex > titleRowIndex);
  assert.ok(envIndex > buttonIndex);
  assert.ok(descriptionIndex > headerIndex);
  assert.ok(descriptionIndex > envIndex);
  assert.doesNotMatch(widgetSource, /Use Template/);
});

test('search templates widget renders run mode as compact local and cloud icons', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTemplatesApp.tsx'),
    'utf8'
  );

  assert.match(widgetSource, /template-run-icons/);
  assert.match(widgetSource, /template-run-icon--local/);
  assert.match(widgetSource, /template-run-icon--cloud/);
  assert.match(widgetSource, /supportsLocalRun/);
  assert.match(widgetSource, /supportsCloudRun/);
  assert.doesNotMatch(widgetSource, /card\.runOnLabel\}/);
});

test('search templates widget switches grid layout by card count with at most two rows', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTemplatesApp.tsx'),
    'utf8'
  );
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'styles', 'base.css'),
    'utf8'
  );

  assert.match(widgetSource, /getTemplateGridClass/);
  assert.match(widgetSource, /cards\.length <= 3/);
  assert.match(widgetSource, /cards\.length <= 6/);
  assert.match(widgetSource, /template-grid--one-row/);
  assert.match(widgetSource, /template-grid--two-row/);
  assert.match(widgetSource, /template-grid--two-row-scroll/);
  assert.match(cssSource, /grid-template-rows:\s*repeat\(2,\s*auto\)/);
  assert.match(cssSource, /overflow-x:\s*auto/);
  assert.match(cssSource, /-webkit-line-clamp:\s*2/);
});

test('search templates widget uses denser card typography and icon-like likes', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTemplatesApp.tsx'),
    'utf8'
  );
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'styles', 'base.css'),
    'utf8'
  );

  assert.doesNotMatch(widgetSource, /Local only/);
  assert.match(widgetSource, /Local-only template/);
  assert.match(widgetSource, /♡/);
  assert.match(cssSource, /template-card__header h2[\s\S]*font-size:\s*14px/);
  assert.match(cssSource, /template-card__header h2[\s\S]*-webkit-line-clamp:\s*2/);
  assert.match(cssSource, /template-card__title-row[\s\S]*align-items:\s*center/);
  assert.match(cssSource, /template-card__title-row[\s\S]*min-height:\s*48px/);
  assert.match(cssSource, /template-card[\s\S]*padding:\s*14px/);
  assert.match(cssSource, /template-card__footer[\s\S]*font-size:\s*12px/);
  assert.match(cssSource, /template-card__footer[\s\S]*margin-top:\s*auto/);
  assert.match(cssSource, /template-meta--likes/);
});

test('search templates widget renders local-only use action as disabled with hover guidance', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTemplatesApp.tsx'),
    'utf8'
  );
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'styles', 'base.css'),
    'utf8'
  );

  assert.match(widgetSource, /card\.selectionMode === 'local_only'/);
  assert.match(widgetSource, /disabled=\{card\.selectionMode === 'local_only' \|\| isActive\}/);
  assert.match(widgetSource, /template-button--disabled/);
  assert.match(widgetSource, /Local-only templates can only run in the desktop app/);
  assert.match(cssSource, /\.template-button--disabled/);
  assert.match(cssSource, /\.template-button--disabled:hover/);
  assert.match(cssSource, /cursor:\s*not-allowed/);
});

test('search tasks widget sends configured follow-up messages for start and stop actions', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTasksApp.tsx'),
    'utf8'
  );
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'styles', 'base.css'),
    'utf8'
  );

  assert.doesNotMatch(widgetSource, /STATUS_LABELS/);
  assert.doesNotMatch(widgetSource, /tabs-row/);
  assert.doesNotMatch(widgetSource, /chip-accent/);
  assert.doesNotMatch(widgetSource, /filtersApplied\?\.status/);
  assert.match(widgetSource, /sendTaskActionPrompt/);
  assert.match(widgetSource, /ui\/message/);
  assert.match(widgetSource, /role:\s*'user'/);
  assert.doesNotMatch(widgetSource, /sendFollowUpMessage/);
  assert.doesNotMatch(widgetSource, /scrollToBottom:\s*true/);
  assert.match(widgetSource, /startTaskPromptTemplate/);
  assert.match(widgetSource, /stopTaskPromptTemplate/);
  assert.match(widgetSource, /renderActionButton\(row,\s*'start'\)/);
  assert.match(widgetSource, /renderActionButton\(row,\s*'stop'\)/);
  assert.match(widgetSource, /task-action-button--\$\{action\}/);
  assert.match(cssSource, /\.task-action-button--start[\s\S]*var\(--success-soft\)/);
  assert.match(cssSource, /\.task-action-button--stop[\s\S]*#b3382e/);
  assert.doesNotMatch(widgetSource, /callTool/);
  assert.doesNotMatch(widgetSource, /start_or_stop_task/);
  assert.match(widgetSource, /<th>#<\/th>/);
  assert.match(widgetSource, /<th>Task Name<\/th>/);
  assert.match(widgetSource, /<th>Status<\/th>/);
  assert.match(widgetSource, /<th>Actions<\/th>/);
  assert.doesNotMatch(widgetSource, /<th>Owner<\/th>/);
  assert.doesNotMatch(widgetSource, /<th>Version<\/th>/);
});

test('search tasks presenter passes action prompt templates and keeps model text summarized for UI lists', () => {
  const response = presentSearchTasksResult(
    {
      success: true,
      page: 1,
      size: 2,
      total: 2,
      currentTotal: 2,
      totalPages: 1,
      tasks: [
        {
          taskId: 'task-running',
          taskName: 'Running Task',
          taskStatusLabel: 'Running',
          rawTaskStatusCode: 1,
          taskDescription: 'Detailed running task description'
        },
        {
          taskId: 'task-stopped',
          taskName: 'Stopped Task',
          taskStatusLabel: 'Stopped',
          rawTaskStatusCode: 2,
          taskDescription: 'Detailed stopped task description'
        }
      ]
    },
    {
      resourceUri: 'ui://widget/search-tasks.html'
    }
  );

  assert.equal(response.content[0].text, 'Found 2 task results.');
  assert.doesNotMatch(response.content[0].text, /task-running|Running Task|Detailed running task description/);
  assert.equal(response._meta.startTaskPromptTemplate, 'Try to start or restart task {taskId}.');
  assert.equal(response._meta.stopTaskPromptTemplate, 'Try to stop task {taskId}.');
  assert.equal(response._meta.rows[0].statusTone, 'running');
  assert.equal(response._meta.rows[1].statusTone, 'stopped');
});

test('search templates widget keeps template cards simple and avoids inline parameter setup', () => {
  const widgetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'web', 'src', 'components', 'SearchTemplatesApp.tsx'),
    'utf8'
  );

  assert.doesNotMatch(widgetSource, /sourceOptions/);
  assert.doesNotMatch(widgetSource, /inputSchema/);
  assert.doesNotMatch(widgetSource, /Output Schema/);
  assert.doesNotMatch(widgetSource, /validateOnly:\s*true/);
  assert.doesNotMatch(widgetSource, /Parameter Summary/);
});

test('executeToolWithMiddleware preserves structuredContent and widget _meta for widget-enabled tools', async () => {
  const tool = {
    name: 'widget_tool',
    title: 'Widget tool',
    description: 'Returns a widget result',
    requiresAuth: false,
    inputSchema: z.object({ keyword: z.string() }),
    uiBinding: {
      resourceUri: 'ui://widget/search-templates.html',
      presenter(result) {
        return {
          content: [
            {
              type: 'text',
              text: `Prepared widget for ${result.keyword}`
            }
          ],
          structuredContent: {
            keyword: result.keyword,
            total: result.total
          },
          _meta: {
            'openai/outputTemplate': 'ui://widget/search-templates.html',
            cards: result.cards
          }
        };
      }
    },
    handler: async (input) => ({
      keyword: input.keyword,
      total: 1,
      cards: [{ id: 'card-1' }]
    })
  };

  const response = await executeToolWithMiddleware(tool, async () => undefined, {
    keyword: 'maps'
  });

  assert.equal(response.content[0].text, 'Prepared widget for maps');
  assert.deepEqual(response.structuredContent, {
    keyword: 'maps',
    total: 1
  });
  assert.equal(response._meta['openai/outputTemplate'], 'ui://widget/search-templates.html');
  assert.deepEqual(response._meta.cards, [{ id: 'card-1' }]);
});

test('registerAllResources registers the OpenAI App widget resources', () => {
  const registered = [];
  const fakeServer = {
    registerResource(name, uri, meta, handler) {
      registered.push({ name, uri, meta, handler });
    }
  };

  registerAllResources(fakeServer);

  assert.equal(
    registered.some((entry) => entry.uri === 'ui://widget/search-templates.html'),
    true
  );
  assert.equal(
    registered.some((entry) => entry.uri === 'ui://widget/search-tasks.html'),
    true
  );
});

async function loadBootstrapModule() {
  const sourcePath = path.resolve(process.cwd(), 'web', 'src', 'shared', 'bootstrap.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  });

  const tempDir = path.resolve(process.cwd(), 'web', '.tmp-test-modules');
  fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(
    tempDir,
    `bootstrap-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`
  );
  fs.writeFileSync(tempPath, transpiled.outputText, 'utf8');

  try {
    return await import(pathToFileURL(tempPath).href);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

async function withBootstrapModule(run) {
  const tempDir = path.resolve(process.cwd(), 'web', '.tmp-test-modules');
  cleanupBootstrapTempModules(tempDir);
  const bootstrap = await loadBootstrapModule();

  try {
    return await run(bootstrap);
  } finally {
    const after = listBootstrapTempModules(tempDir);
    assert.deepEqual(after, []);
  }
}

function listBootstrapTempModules(tempDir) {
  if (!fs.existsSync(tempDir)) {
    return [];
  }

  return fs.readdirSync(tempDir).filter((entry) => entry.startsWith('bootstrap-'));
}

function cleanupBootstrapTempModules(tempDir) {
  const entries = listBootstrapTempModules(tempDir);
  for (const entry of entries) {
    fs.unlinkSync(path.join(tempDir, entry));
  }
}

function withWindowState(toolOutput, toolResponseMetadata, run) {
  const previousWindow = globalThis.window;
  globalThis.window = {
    openai: {
      toolOutput,
      toolResponseMetadata
    }
  };

  try {
    return run();
  } finally {
    globalThis.window = previousWindow;
  }
}
