import test from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

process.env.CLIENTAPI_BASE_URL = process.env.CLIENTAPI_BASE_URL || 'https://client-api.example.com';
process.env.OFFICIAL_SITE_URL = process.env.OFFICIAL_SITE_URL || 'https://bazhuayu.example.com';
process.env.LOG_ENABLE_CONSOLE = 'false';
process.env.LOG_ENABLE_FILE = 'false';

const { executeToolDirect } = await import('../dist/tools.js');
const { executeToolWithMiddleware } = await import('../dist/tools/tool-registry.js');
const { Logger } = await import('../dist/utils/logger.js');

test('executeToolDirect emits start and success logs through the direct-path logger sink', async () => {
  const originalInfo = Logger.info;
  const infoCalls = [];

  Logger.info = (message, options) => {
    infoCalls.push({ message, options });
  };

  try {
    const result = await executeToolDirect(
      {
        name: 'direct_logging_tool',
        title: 'Direct logging tool',
        description: 'Logs through the direct execution path',
        requiresAuth: false,
        inputSchema: z.object({ value: z.string() }),
        handler: async ({ value }) => ({
          echoed: value
        })
      },
      {
        value: 'hello'
      }
    );

    assert.equal(result.isError, undefined);
    assert.equal(infoCalls.some((entry) => String(entry.message).includes('Starting tool: direct_logging_tool')), true);
    assert.equal(infoCalls.some((entry) => String(entry.message).includes('Tool succeeded: direct_logging_tool')), true);
    assert.equal(
      infoCalls.every((entry) => entry.options?.loggerName === 'bazhuayu.mcp.tool'),
      true
    );
  } finally {
    Logger.info = originalInfo;
  }
});

test('executeToolDirect emits failures through Logger.logError for richer direct-path diagnostics', async () => {
  const originalLogError = Logger.logError;
  const originalError = Logger.error;
  const originalInfo = Logger.info;
  const logErrorCalls = [];
  const errorCalls = [];

  Logger.logError = (message, error, options) => {
    logErrorCalls.push({ message, error, options });
  };
  Logger.error = (message, options) => {
    errorCalls.push({ message, options });
  };
  Logger.info = () => {};

  try {
    const result = await executeToolDirect(
      {
        name: 'direct_logging_failure_tool',
        title: 'Direct logging failure tool',
        description: 'Fails through the direct execution path',
        requiresAuth: false,
        inputSchema: z.object({}),
        handler: async () => {
          throw new Error('simulated direct failure');
        }
      },
      {}
    );

    assert.equal(result.isError, true);
    assert.equal(logErrorCalls.length, 1);
    assert.equal(String(logErrorCalls[0].message).includes('Tool failed: direct_logging_failure_tool - simulated direct failure'), true);
    assert.equal(logErrorCalls[0].error.message, 'simulated direct failure');
    assert.equal(logErrorCalls[0].options?.loggerName, 'bazhuayu.mcp.tool');
    assert.equal(
      errorCalls.some((entry) => entry.options?.loggerName === 'bazhuayu.mcp.tool'),
      false
    );
  } finally {
    Logger.logError = originalLogError;
    Logger.error = originalError;
    Logger.info = originalInfo;
  }
});

test('executeToolWithMiddleware works without an explicit log sink', async () => {
  const result = await executeToolWithMiddleware(
    {
      name: 'no_sink_tool',
      title: 'No sink tool',
      description: 'Executes without explicit logging configuration',
      requiresAuth: false,
      inputSchema: z.object({ value: z.string() }),
      handler: async ({ value }) => ({
        echoed: value
      })
    },
    async () => undefined,
    {
      value: 'hello'
    }
  );

  assert.equal(result.isError, undefined);
  assert.equal(String(result.content[0].text).includes('"echoed": "hello"'), true);
});
