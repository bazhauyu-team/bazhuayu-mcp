import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CLIENTAPI_BASE_URL = process.env.CLIENTAPI_BASE_URL || 'https://client-api.example.com';
process.env.OFFICIAL_SITE_URL = process.env.OFFICIAL_SITE_URL || 'https://bazhuayu.example.com';
process.env.SEARCH_TEMPLATE_PAGE_SIZE = process.env.SEARCH_TEMPLATE_PAGE_SIZE || '8';
process.env.EXECUTE_TASK_POLL_MAX_MINUTES = process.env.EXECUTE_TASK_POLL_MAX_MINUTES || '10';

const {
  searchTemplateTool,
  executeTaskTool,
  createExecuteTaskTool
} = await import('../dist/tools/workflow-tools.js');
const { exportDataTool } = await import('../dist/tools/export-data-tool.js');
const { InMemoryExecutionTaskStore } = await import('../dist/tasks/execution-task-store.js');
const { RequestContextManager } = await import('../dist/utils/request-context.js');
const { AppConfig } = await import('../dist/config/app-config.js');
const {
  AsyncExportFileStatus,
  TaskExecuteStatus,
  StartTaskResult
} = await import('../dist/api/types.js');

async function withEnvOverride(overrides, callback) {
  const previousValues = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    AppConfig.reset();
    return await callback();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    AppConfig.reset();
  }
}

function createKeywordSearchApiStub() {
  const searchCalls = [];
  const cloudTemplates = [
    {
      id: 42,
      slug: 'amazon-cloud',
      name: 'Amazon Cloud',
      description: 'Cloud template',
      runOn: 2
    }
  ];
  const localTemplates = [
    {
      id: 84,
      slug: 'amazon-local',
      name: 'Amazon Local',
      description: 'Local template',
      runOn: 1
    }
  ];

  return {
    searchCalls,
    api: {
      searchTemplates: async (input) => {
        searchCalls.push({
          keyword: input.keyword,
          limit: input.limit,
          runOns: input.runOns
        });

        if (input.runOns === '2,3') {
          return { data: cloudTemplates.slice(0, input.limit) };
        }

        if (input.runOns === '1') {
          return { data: localTemplates.slice(0, input.limit) };
        }

        throw new Error(`Unexpected runOns: ${input.runOns}`);
      },
      getTemplateCurrentVersions: async () => ([])
    }
  };
}

test('search_templates returns recommendedTemplate and local-only guidance', async () => {
  const api = {
    searchTemplates: async (input) => ({
      data:
        input.runOns === '2,3'
          ? [
              {
                slug: 'amazon-cloud',
                name: 'Amazon Cloud',
                description: 'Cloud template',
                runOn: 2,
                likes: 120
              }
            ]
          : [
              {
                slug: 'amazon-local',
                name: 'Amazon Local',
                description: 'Desktop only template',
                runOn: 1,
                likes: 999
              }
            ]
    })
  };

  const result = await searchTemplateTool.handler({ keyword: 'amazon' }, api);

  assert.equal(result.recommendedTemplate.templateName, 'amazon-cloud');
  assert.equal(result.recommendedTemplate.reason, 'best_cloud_relevance_match');
  assert.equal(result.recommendedTemplate.rankInRawResults, 1);
  assert.equal(result.templates.length >= 1, true);
  assert.equal(result.templates[0].templateName, 'amazon-cloud');
});

test('search_templates returns unified display fields without language switching', async () => {
  await withEnvOverride({ HTTP_ACCEPT_LANGUAGE: 'en-US' }, async () => {
    const api = {
      searchTemplates: async () => ({
        data: [
          {
            id: 42,
            slug: 'amazon-cloud',
            internalName: 'internal-amazon-cloud',
            name: 'Amazon Unified',
            description: 'Unified cloud template description',
            imageUrl: 'https://img.example.com/unified.png',
            runOn: 2,
            likes: 120
          }
        ]
      }),
      getTemplateCurrentVersions: async () => ([])
    };

    const result = await searchTemplateTool.handler({ keyword: 'amazon' }, api);

    assert.equal(result.recommendedTemplate.displayName, 'Amazon Unified');
    assert.equal(result.recommendedTemplate.shortDescription, 'Unified cloud template description');
    assert.equal(result.recommendedTemplate.imageUrl, 'https://img.example.com/unified.png');
    assert.equal(result.templates[0].displayName, 'Amazon Unified');
    assert.equal(result.templates[0].shortDescription, 'Unified cloud template description');
    assert.equal(result.templates[0].imageUrl, 'https://img.example.com/unified.png');
  });
});

test('search_templates returns widget selection metadata for cloud and local templates', async () => {
  const { api, searchCalls } = createKeywordSearchApiStub();

  const result = await searchTemplateTool.handler({ keyword: 'amazon', limit: 2 }, api);

  assert.deepEqual(searchCalls, [
    { keyword: 'amazon', limit: 2, runOns: '2,3' },
    { keyword: 'amazon', limit: 1, runOns: '1' }
  ]);
  assert.deepEqual(
    result.templates.map((template) => template.templateName),
    ['amazon-cloud', 'amazon-local']
  );
  assert.equal(result.templates[0].selectionMode, 'execute_task');
  assert.equal(result.templates[0].selectable, true);
  assert.equal(result.templates[0].templateRef.templateId, 42);
  assert.equal(result.templates[0].templateRef.templateName, 'amazon-cloud');
  assert.equal(result.templates[1].selectionMode, 'local_only');
  assert.equal(result.templates[1].selectable, false);
  assert.equal(result.templates[1].templateRef.templateId, 84);
});

test('search_templates presenter preserves widget selection metadata at the MCP boundary', async () => {
  const { api } = createKeywordSearchApiStub();
  const handlerResult = await searchTemplateTool.handler({ keyword: 'amazon', limit: 2 }, api);

  const presented = searchTemplateTool.uiBinding.presenter(handlerResult);

  assert.equal(presented.structuredContent.templates[0].selectionMode, 'execute_task');
  assert.equal(presented.structuredContent.templates[0].selectable, true);
  assert.equal(presented.structuredContent.templates[0].templateRef.templateId, 42);
  assert.equal(presented.structuredContent.templates[1].selectionMode, 'local_only');
  assert.equal(presented.structuredContent.templates[1].selectable, false);
  assert.equal(presented._meta.cards[1].templateRef.templateId, 84);
});

test('search_templates treats unknown runOn rows as non-selectable to match supportsCloudScraping', async () => {
  const api = {
    searchTemplates: async (input) => {
      if (input.runOns === '2,3') {
        return {
          data: [
            {
              id: 99,
              slug: 'amazon-unknown-runtime',
              name: 'Amazon Unknown Runtime',
              description: 'Template with unknown runtime',
              runOn: 999
            }
          ]
        };
      }

      if (input.runOns === '1') {
        return { data: [] };
      }

      throw new Error(`Unexpected runOns: ${input.runOns}`);
    },
    getTemplateCurrentVersions: async () => ([])
  };

  const result = await searchTemplateTool.handler({ keyword: 'amazon', limit: 1 }, api);

  assert.equal(result.templates[0].supportsCloudScraping, false);
  assert.equal(result.templates[0].selectable, false);
  assert.equal(result.templates[0].selectionMode, 'local_only');
});

test('search_templates ignores HTTP_ACCEPT_LANGUAGE when unified fields exist', async () => {
  await withEnvOverride({ HTTP_ACCEPT_LANGUAGE: 'zh-CN' }, async () => {
    const api = {
      searchTemplates: async () => ({
        data: [
          {
            id: 77,
            slug: 'xiaohongshu-cloud',
            internalName: 'internal-xhs-cloud',
            name: 'Xiaohongshu Unified',
            description: 'Unified xhs description',
            imageUrl: 'https://img.example.com/unified-xhs.png',
            runOn: 2,
            likes: 88
          }
        ]
      }),
      getTemplateCurrentVersions: async () => ([])
    };

    const result = await searchTemplateTool.handler({ keyword: 'xiaohongshu' }, api);

    assert.equal(result.recommendedTemplate.displayName, 'Xiaohongshu Unified');
    assert.equal(result.recommendedTemplate.shortDescription, 'Unified xhs description');
    assert.equal(result.recommendedTemplate.imageUrl, 'https://img.example.com/unified-xhs.png');
    assert.equal(result.templates[0].displayName, 'Xiaohongshu Unified');
    assert.equal(result.templates[0].shortDescription, 'Unified xhs description');
    assert.equal(result.templates[0].imageUrl, 'https://img.example.com/unified-xhs.png');
  });
});

test('search_templates supports exact template id lookup', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'SearchKeyword',
      DisplayText: 'Search Keyword',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);

  const api = {
    getTemplateView: async (id) => ({
      id,
      slug: 'google-search-scraper',
      name: 'Google Search Scraper',
      prompts: 'Search Google and collect SERP rows.',
      runOn: 2,
      parameters: paramsJson
    }),
    getTemplateCurrentVersion: async () => ({
      parameters: paramsJson
    })
  };

  const result = await searchTemplateTool.handler({ id: 15 }, api);

  assert.equal(result.success, true);
  assert.equal(result.queryMode, 'id');
  assert.equal(result.template.templateId, 15);
  assert.equal(result.template.templateName, 'google-search-scraper');
  assert.equal(result.template.inputSchema.length, 1);
  assert.equal(result.template.inputSchema[0].field, 'search_keyword');
  assert.equal(result.template.inputSchema[0].label, 'Search Keyword');
  assert.equal('parameterHints' in result.template, false);
});

test('search_templates exact id presenter preserves selection metadata for cloud templates', async () => {
  const api = {
    getTemplateView: async (id) => ({
      id,
      slug: 'google-search-scraper',
      name: 'Google Search Scraper',
      prompts: 'Search Google and collect SERP rows.',
      runOn: 2,
      parameters: '[]'
    }),
    getTemplateCurrentVersion: async () => ({
      parameters: '[]'
    })
  };

  const handlerResult = await searchTemplateTool.handler({ id: 15 }, api);
  const presented = searchTemplateTool.uiBinding.presenter(handlerResult);

  assert.equal(presented.structuredContent.templates[0].selectionMode, 'execute_task');
  assert.equal(presented.structuredContent.templates[0].selectable, true);
  assert.equal(presented.structuredContent.templates[0].templateRef.templateId, 15);
  assert.equal(presented.structuredContent.templates[0].templateRef.templateName, 'google-search-scraper');
  assert.equal(presented._meta.cards[0].selectionMode, 'execute_task');
});

test('search_templates falls back to keyword search when direct id lookup returns empty', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'SearchKeyword',
      DisplayText: 'Search Keyword',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);

  const api = {
    getTemplateView: async () => undefined,
    searchTemplates: async () => ({
      data: [
        {
          id: 95,
          slug: 'google-search-scraper',
          internalName: 'Google Search Scraper',
          name: 'Google Search Scraper',
          description: 'Search Google and collect SERP rows.',
          runOn: 2
        }
      ]
    }),
    getTemplateCurrentVersion: async () => ({
      parameters: paramsJson
    })
  };

  const result = await searchTemplateTool.handler({ id: 95 }, api);

  assert.equal(result.success, true);
  assert.equal(result.queryMode, 'id');
  assert.equal(result.template.templateId, 95);
  assert.equal(result.template.templateName, 'google-search-scraper');
  assert.equal(result.template.inputSchema[0].field, 'search_keyword');
  assert.equal('parameterHints' in result.template, false);
});

test('search_templates returns a graceful error when exact id lookup finds nothing', async () => {
  const api = {
    getTemplateView: async () => undefined,
    searchTemplates: async () => ({ data: [] })
  };

  const result = await searchTemplateTool.handler({ id: 95 }, api);

  assert.equal(result.success, false);
  assert.equal(result.error, 'template_resolution_failed');
  assert.equal(result.queryMode, 'id');
  assert.match(result.message, /Template id 95 not found/i);
});

test('search_templates supports exact slug lookup', async () => {
  const api = {
    getTemplateBySlug: async (slug) => ({
      id: 15,
      slug,
      name: 'Google Search Scraper',
      prompts: 'Search Google and collect SERP rows.',
      runOn: 2,
      parameters: '[]'
    }),
    getTemplateCurrentVersion: async () => ({
      parameters: '[]'
    })
  };

  const result = await searchTemplateTool.handler({ slug: 'google-search-scraper' }, api);

  assert.equal(result.success, true);
  assert.equal(result.queryMode, 'slug');
  assert.equal(result.template.templateId, 15);
  assert.equal(result.template.templateName, 'google-search-scraper');
});

test('search_templates exact slug presenter preserves selection metadata for local-only templates', async () => {
  const api = {
    getTemplateBySlug: async (slug) => ({
      id: 27,
      slug,
      name: 'Google Maps Desktop Scraper',
      prompts: 'Desktop-only template.',
      runOn: 1,
      parameters: '[]'
    }),
    getTemplateCurrentVersion: async () => ({
      parameters: '[]'
    })
  };

  const handlerResult = await searchTemplateTool.handler({ slug: 'google-maps-desktop-scraper' }, api);
  const presented = searchTemplateTool.uiBinding.presenter(handlerResult);

  assert.equal(presented.structuredContent.templates[0].selectionMode, 'local_only');
  assert.equal(presented.structuredContent.templates[0].selectable, false);
  assert.equal(presented.structuredContent.templates[0].templateRef.templateId, 27);
  assert.equal(
    presented.structuredContent.templates[0].templateRef.templateName,
    'google-maps-desktop-scraper'
  );
  assert.equal(presented._meta.cards[0].selectionMode, 'local_only');
});

test('search_templates rejects mixed keyword and exact selectors', async () => {
  const parseResult = searchTemplateTool.inputSchema.safeParse({
    keyword: 'google',
    id: 15
  });

  assert.equal(parseResult.success, false);
});

test('execute_task validateOnly validates parameters without creating a task', async () => {
  let createTaskCalls = 0;
  let startTaskCalls = 0;

  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'SearchKeyword',
      DisplayText: 'Search Keyword',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);

  const api = {
    getTemplateBySlug: async () => ({
      id: 42,
      runOn: 2,
      name: 'Amazon Cloud',
      parameters: paramsJson,
      userPermission: { hasPermission: true }
    }),
    getAccountInfo: async () => ({ currentAccountLevel: 120 }),
    getTemplateCurrentVersion: async () => ({
      id: 420,
      version: 7,
      parameters: paramsJson
    }),
    createTemplateTask: async () => {
      createTaskCalls += 1;
      return { taskId: 'unexpected' };
    },
    startTask: async () => {
      startTaskCalls += 1;
      return { result: 0 };
    }
  };

  const result = await executeTaskTool.handler(
    {
      templateName: 'amazon-cloud',
      validateOnly: true,
      parameters: {
        keyword: ['iphone']
      }
    },
    api
  );

  assert.equal(result.success, true);
  assert.equal(result.validateOnly, true);
  assert.equal(result.status, 'ready');
  assert.equal(result.canExecuteNow, true);
  assert.deepEqual(result.blockingIssues, []);
  assert.match(result.nextAction, /can create/i);
  assert.equal(result.templateId, 42);
  assert.equal(result.inputSchema.length, 1);
  assert.equal(result.inputSchema[0].field, 'search_keyword');
  assert.equal(result.normalizedParametersPreview.templateParameters.length, 1);
  assert.equal(result.normalizedParametersPreview.templateParameters[0].paramName, 'SearchKeyword');
  assert.deepEqual(result.normalizedParametersPreview.templateParameters[0].value, ['iphone']);
  assert.equal('parameterHints' in result, false);
  assert.equal(createTaskCalls, 0);
  assert.equal(startTaskCalls, 0);
});

test('execute_task returns missing_required_parameters before task creation', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'SearchKeyword',
      DisplayText: 'Search Keyword',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);

  const api = {
    getTemplateBySlug: async () => ({
      id: 42,
      runOn: 2,
      name: 'Amazon Cloud',
      parameters: paramsJson,
      userPermission: { hasPermission: true }
    }),
    getAccountInfo: async () => ({ currentAccountLevel: 120 }),
    getTemplateCurrentVersion: async () => ({
      id: 420,
      version: 7,
      parameters: paramsJson
    })
  };

  const result = await executeTaskTool.handler(
    {
      templateName: 'amazon-cloud',
      parameters: {}
    },
    api
  );

  assert.equal(result.success, false);
  assert.equal(result.error, 'missing_required_parameters');
  assert.deepEqual(result.missingParamNames, ['search_keyword']);
  assert.equal(result.inputSchema[0].field, 'search_keyword');
  assert.equal('parameterHints' in result, false);
  assert.equal(result.recoverable, true);
});

test('export_data returns exported preview rows from the authoritative export tool', async () => {
  const api = {
    getTaskStatusById: async () => ({
      taskId: 'task-1',
      status: TaskExecuteStatus.Finished,
      lot: 'lot-1',
      dataCount: 2
    }),
    createAsyncCloudStorageExport: async () => {},
    getLastExportPreview: async () => ({
      latestExportFileStatus: AsyncExportFileStatus.Generated,
      latestExportFileUrl: 'https://download.example.com/export.json',
      collectedDataTotal: 2,
      collectedDataSample: [
        { title: 'Row 1', price: '$10' },
        { title: 'Row 2', price: '$20' }
      ]
    })
  };

  const result = await exportDataTool.handler(
    {
      taskId: 'task-1'
    },
    api
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'exported');
  assert.equal(result.lot, 'lot-1');
  assert.equal(result.dataTotal, 2);
  assert.equal(result.exportFileUrl, 'https://download.example.com/export.json');
  assert.equal(result.sampleData.length, 2);
  assert.equal(result.sampleRowCount, 2);
  assert.match(result.toolHint, /Present sampleData as a table/i);
});

test('export_data truncates long preview values for token efficiency', async () => {
  const api = {
    getTaskStatusById: async () => ({
      taskId: 'task-compact',
      status: TaskExecuteStatus.Finished,
      lot: 'lot-compact',
      dataCount: 1
    }),
    createAsyncCloudStorageExport: async () => {},
    getLastExportPreview: async () => ({
      latestExportFileStatus: AsyncExportFileStatus.Generated,
      latestExportFileUrl: 'https://download.example.com/export.json',
      collectedDataTotal: 1,
      collectedDataSample: [
        {
          a: 'x'.repeat(220),
          b: 'value-b',
          nested: {
            text: 'y'.repeat(220)
          }
        }
      ]
    })
  };

  const result = await exportDataTool.handler(
    {
      taskId: 'task-compact'
    },
    api
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'exported');
  assert.equal(result.sampleData[0].a, `${'x'.repeat(128)}...`);
  assert.equal(result.sampleData[0].nested.text, `${'y'.repeat(128)}...`);
});

test('export_data returns collecting state while the task is still running', async () => {
  const api = {
    getTaskStatusById: async () => ({
      taskId: 'task-preview',
      status: TaskExecuteStatus.Executing,
      lot: 'lot-preview',
      dataCount: 2
    })
  };

  const result = await exportDataTool.handler(
    {
      taskId: 'task-preview'
    },
    api
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'collecting');
  assert.equal(result.taskStatus, TaskExecuteStatus.Executing);
  assert.equal(result.taskStatusLabel, 'Executing');
  assert.equal(result.dataTotal, 2);
  assert.equal(result.retryGuidance.tool, 'export_data');
  assert.equal(result.retryGuidance.waitSecondsMin, 10);
  assert.equal(result.retryGuidance.waitSecondsMax, 30);
  assert.match(result.retryGuidance.instruction, /10-30 seconds/i);
  assert.match(result.toolHint, /tasks\/get/i);
  assert.match(result.message, /prefer tasks\/get/i);
  assert.match(result.suggestion, /10-30 seconds/i);
});

test('export_data returns no_data when export completes without collected rows', async () => {
  const api = {
    getTaskStatusById: async () => ({
      taskId: 'task-exported',
      status: TaskExecuteStatus.Finished,
      lot: 'lot-exported',
      dataCount: 0
    }),
    createAsyncCloudStorageExport: async () => {},
    getLastExportPreview: async () => ({
      latestExportFileStatus: AsyncExportFileStatus.Generated,
      latestExportFileUrl: 'https://download.example.com/task-exported.json',
      collectedDataTotal: 0,
      collectedDataSample: []
    })
  };

  const result = await exportDataTool.handler(
    {
      taskId: 'task-exported'
    },
    api
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'no_data');
  assert.equal(result.lot, 'lot-exported');
  assert.equal(result.exportFileUrl, 'https://download.example.com/task-exported.json');
  assert.match(result.message, /no data was collected/i);
});

test('export_data returns exporting retry guidance while export file is still being generated', async () => {
  const api = {
    getTaskStatusById: async () => ({
      taskId: 'task-exporting',
      status: TaskExecuteStatus.Finished,
      lot: 'lot-exporting',
      dataCount: 12
    }),
    createAsyncCloudStorageExport: async () => {},
    getLastExportPreview: async () => ({
      latestExportFileStatus: AsyncExportFileStatus.WaitingGenerate,
      latestExportFileUrl: 'https://download.example.com/task-exporting.csv',
      exportProgressPercent: 65,
      collectedDataTotal: 12,
      collectedDataSample: []
    })
  };

  const result = await exportDataTool.handler(
    {
      taskId: 'task-exporting',
      exportFileType: 'CSV'
    },
    api
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'exporting');
  assert.equal(result.retryGuidance.tool, 'export_data');
  assert.equal(result.retryGuidance.waitSecondsMin, 10);
  assert.equal(result.retryGuidance.waitSecondsMax, 30);
  assert.match(result.retryGuidance.instruction, /10-30 seconds/i);
  assert.match(result.message, /still being generated/i);
  assert.match(result.suggestion, /10-30 seconds/i);
});

test('execute_task non-task mode returns accepted export_data follow-up guidance without polling', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'MainKeys',
      DisplayText: 'Main Keys',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);
  const api = {
    getTemplateBySlug: async () => ({
      id: 42,
      runOn: 2,
      name: 'Amazon Product Details',
      parameters: paramsJson,
      userPermission: { hasPermission: true }
    }),
    getAccountInfo: async () => ({ currentAccountLevel: 120 }),
    getTemplateCurrentVersion: async () => ({
      id: 420,
      version: 7,
      parameters: paramsJson
    }),
    createTemplateTask: async () => ({ taskId: 'octo-task-sync-1' }),
    startTask: async () => ({ result: StartTaskResult.SUCCESS }),
    getTaskStatus: async () => {
      throw new Error('getTaskStatus should not be called for non-task execute_task runs');
    }
  };

  const result = await executeTaskTool.handler(
    {
      templateName: 'amazon-product-details-scraper',
      parameters: {
        MainKeys: ['059035342X']
      }
    },
    api
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.taskId, 'octo-task-sync-1');
  assert.equal(result.templateName, 'amazon-product-details-scraper');
  assert.match(result.message, /export_data/i);
  assert.equal(result.retryGuidance.tool, 'export_data');
  assert.equal(result.retryGuidance.waitSecondsMin, 10);
  assert.equal(result.retryGuidance.waitSecondsMax, 30);
  assert.match(result.retryGuidance.instruction, /10-30 seconds/i);
  assert.equal(result.workflow.nextTool, 'export_data');
  assert.equal(result.workflow.followupMode, 'export_data_polling');
  assert.equal(result.suggestedNextCall.tool, 'export_data');
  assert.equal(result.suggestedNextCall.args.taskId, 'octo-task-sync-1');
  assert.equal(result.progress, undefined);
});

test('execute_task non-task mode rejects targetMaxRows with explicit task-mode guidance', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'MainKeys',
      DisplayText: 'Main Keys',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);

  const api = {
    getTemplateBySlug: async () => ({
      id: 42,
      runOn: 2,
      name: 'Amazon Product Details',
      parameters: paramsJson,
      userPermission: { hasPermission: true }
    }),
    getAccountInfo: async () => ({ currentAccountLevel: 120 }),
    getTemplateCurrentVersion: async () => ({
      id: 420,
      version: 7,
      parameters: paramsJson
    }),
    createTemplateTask: async () => ({ taskId: 'octo-task-sync-target' }),
    startTask: async () => ({ result: StartTaskResult.SUCCESS }),
    getTaskStatus: async () => {
      throw new Error('getTaskStatus should not be called when targetMaxRows is rejected');
    }
  };

  const result = await executeTaskTool.handler(
    {
      templateName: 'amazon-product-details-scraper',
      parameters: {
        MainKeys: ['059035342X']
      },
      targetMaxRows: 10
    },
    api
  );

  assert.equal(result.success, false);
  assert.equal(result.error, 'target_max_rows_requires_task_mode');
  assert.equal(result.taskId, 'octo-task-sync-target');
  assert.match(result.message, /requires MCP task execution/i);
  assert.equal(result.suggestedNextCall.tool, 'execute_task');
  assert.equal(result.suggestedNextCall.args.targetMaxRows, 10);
});

test('execute_task allows targetMaxRows=0 and treats it as natural completion mode', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'MainKeys',
      DisplayText: 'Main Keys',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);

  const parsed = executeTaskTool.inputSchema.parse({
    templateName: 'amazon-product-details-scraper',
    parameters: {
      MainKeys: ['059035342X']
    },
    targetMaxRows: 0
  });

  assert.equal(parsed.targetMaxRows, 0);

  const api = {
    getTemplateBySlug: async () => ({
      id: 42,
      runOn: 2,
      name: 'Amazon Product Details',
      parameters: paramsJson,
      userPermission: { hasPermission: true }
    }),
    getAccountInfo: async () => ({ currentAccountLevel: 120 }),
    getTemplateCurrentVersion: async () => ({
      id: 420,
      version: 7,
      parameters: paramsJson
    }),
    createTemplateTask: async () => ({ taskId: 'octo-task-sync-zero' }),
    startTask: async () => ({ result: StartTaskResult.SUCCESS }),
    getTaskStatus: async () => {
      throw new Error('getTaskStatus should not be called for non-task execute_task runs');
    }
  };

  const result = await executeTaskTool.handler(parsed, api);

  assert.equal(result.success, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.taskId, 'octo-task-sync-zero');
  assert.match(result.message, /export_data/i);
  assert.equal(result.retryGuidance.waitSecondsMin, 10);
  assert.equal(result.retryGuidance.waitSecondsMax, 30);
  assert.equal(result.workflow.nextTool, 'export_data');
});

test('execute_task accepts parameters as a JSON string for clients that cannot send objects', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'MainKeys',
      DisplayText: 'Main Keys',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);

  const parsed = executeTaskTool.inputSchema.parse({
    templateName: 'amazon-product-details-scraper',
    parameters: '{"MainKeys":["059035342X"]}'
  });

  assert.deepEqual(parsed.parameters, {
    MainKeys: ['059035342X']
  });

  const api = {
    getTemplateBySlug: async () => ({
      id: 42,
      runOn: 2,
      name: 'Amazon Product Details',
      parameters: paramsJson,
      userPermission: { hasPermission: true }
    }),
    getAccountInfo: async () => ({ currentAccountLevel: 120 }),
    getTemplateCurrentVersion: async () => ({
      id: 420,
      version: 7,
      parameters: paramsJson
    }),
    createTemplateTask: async () => ({ taskId: 'octo-task-sync-string-params' }),
    startTask: async () => ({ result: StartTaskResult.SUCCESS }),
    getTaskStatus: async () => {
      throw new Error('getTaskStatus should not be called for non-task execute_task runs');
    }
  };

  const result = await executeTaskTool.handler(parsed, api);

  assert.equal(result.success, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.taskId, 'octo-task-sync-string-params');
  assert.equal(result.retryGuidance.waitSecondsMin, 10);
  assert.equal(result.retryGuidance.waitSecondsMax, 30);
});

test('execute_task task-mode validateOnly returns an immediate completed task instead of throwing', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'SearchKeyword',
      DisplayText: 'Search Keyword',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);
  const store = new InMemoryExecutionTaskStore({
    generateTaskId: () => 'mcp-task-validate-only'
  });
  const requestTaskStore = {
    createTask: (taskParams) =>
      store.createTask(
        taskParams,
        'request-validate-only',
        {
          jsonrpc: '2.0',
          id: 'request-validate-only',
          method: 'tools/call',
          params: {
            name: 'execute_task',
            arguments: {
              templateName: 'amazon-cloud',
              validateOnly: true,
              parameters: {
                search_keyword: ['iphone']
              }
            }
          }
        },
        'session-validate-only'
      ),
    getTask: async (taskId) => {
      const task = await store.getTask(taskId, 'session-validate-only');
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      return task;
    },
    storeTaskResult: (taskId, status, result) =>
      store.storeTaskResult(taskId, status, result, 'session-validate-only'),
    getTaskResult: (taskId) => store.getTaskResult(taskId, 'session-validate-only'),
    updateTaskStatus: (taskId, status, statusMessage) =>
      store.updateTaskStatus(taskId, status, statusMessage, 'session-validate-only'),
    listTasks: (cursor) => store.listTasks(cursor, 'session-validate-only')
  };
  const tool = createExecuteTaskTool();
  const api = {
    getTemplateBySlug: async () => ({
      id: 42,
      runOn: 2,
      name: 'Amazon Cloud',
      parameters: paramsJson,
      userPermission: { hasPermission: true }
    }),
    getAccountInfo: async () => ({ currentAccountLevel: 120 }),
    getTemplateCurrentVersion: async () => ({
      id: 420,
      version: 7,
      parameters: paramsJson
    })
  };

  const result = await tool.taskRegistration.handler.createTask(
    {
      templateName: 'amazon-cloud',
      validateOnly: true,
      parameters: {
        search_keyword: ['iphone']
      }
    },
    async () => api,
    {
      requestId: 'request-validate-only',
      sessionId: 'session-validate-only',
      taskStore: requestTaskStore,
      signal: AbortSignal.timeout(1_000),
      sendNotification: async () => {},
      sendRequest: async () => ({})
    }
  );

  assert.equal(result.task.taskId, 'mcp-task-validate-only');
  assert.equal(result.task.status, 'completed');
  assert.equal(
    result.task.statusMessage,
    'Template parameters validated successfully. No task was created.'
  );

  const finalResult = await requestTaskStore.getTaskResult('mcp-task-validate-only');
  assert.equal(finalResult.isError, undefined);
  assert.equal(finalResult.structuredContent.success, true);
  assert.equal(finalResult.structuredContent.validateOnly, true);
  assert.equal(finalResult.structuredContent.templateId, 42);
  assert.match(finalResult.content[0].text, /validated successfully/i);

  store.cleanup();
});

test('execute_task task-mode preflight failure returns an immediate failed task instead of throwing', async () => {
  const paramsJson = JSON.stringify([
    {
      Id: 'ui-1',
      ParamName: 'SearchKeyword',
      DisplayText: 'Search Keyword',
      ControlType: 'MultiInput',
      IsRequired: true
    }
  ]);
  const store = new InMemoryExecutionTaskStore({
    generateTaskId: () => 'mcp-task-preflight-failed'
  });
  const requestTaskStore = {
    createTask: (taskParams) =>
      store.createTask(
        taskParams,
        'request-preflight-failed',
        {
          jsonrpc: '2.0',
          id: 'request-preflight-failed',
          method: 'tools/call',
          params: {
            name: 'execute_task',
            arguments: {
              templateName: 'amazon-cloud',
              parameters: {}
            }
          }
        },
        'session-preflight-failed'
      ),
    getTask: async (taskId) => {
      const task = await store.getTask(taskId, 'session-preflight-failed');
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      return task;
    },
    storeTaskResult: (taskId, status, result) =>
      store.storeTaskResult(taskId, status, result, 'session-preflight-failed'),
    getTaskResult: (taskId) => store.getTaskResult(taskId, 'session-preflight-failed'),
    updateTaskStatus: (taskId, status, statusMessage) =>
      store.updateTaskStatus(taskId, status, statusMessage, 'session-preflight-failed'),
    listTasks: (cursor) => store.listTasks(cursor, 'session-preflight-failed')
  };
  const tool = createExecuteTaskTool();
  const api = {
    getTemplateBySlug: async () => ({
      id: 42,
      runOn: 2,
      name: 'Amazon Cloud',
      parameters: paramsJson,
      userPermission: { hasPermission: true }
    }),
    getAccountInfo: async () => ({ currentAccountLevel: 120 }),
    getTemplateCurrentVersion: async () => ({
      id: 420,
      version: 7,
      parameters: paramsJson
    })
  };

  const result = await tool.taskRegistration.handler.createTask(
    {
      templateName: 'amazon-cloud',
      parameters: {}
    },
    async () => api,
    {
      requestId: 'request-preflight-failed',
      sessionId: 'session-preflight-failed',
      taskStore: requestTaskStore,
      signal: AbortSignal.timeout(1_000),
      sendNotification: async () => {},
      sendRequest: async () => ({})
    }
  );

  assert.equal(result.task.taskId, 'mcp-task-preflight-failed');
  assert.equal(result.task.status, 'failed');
  assert.match(result.task.statusMessage, /missing/i);

  const finalResult = await requestTaskStore.getTaskResult('mcp-task-preflight-failed');
  assert.equal(finalResult.isError, true);
  assert.equal(finalResult.structuredContent.success, false);
  assert.equal(finalResult.structuredContent.error, 'missing_required_parameters');
  assert.deepEqual(finalResult.structuredContent.missingParamNames, ['search_keyword']);

  store.cleanup();
});
