import test from 'node:test';
import assert from 'node:assert/strict';

import { Logger } from '../dist/utils/logger.js';

test('buildStructuredLog normalizes string exception into an object', () => {
  const structuredLog = Logger.buildStructuredLog({
    timestamp: '2026-04-15T02:29:31.690+00:00',
    level: 'warn',
    message: '',
    loggerName: 'bazhuayu.mcp.http',
    exception: 'HTTP 401'
  });

  assert.deepEqual(structuredLog.exception, {
    message: 'HTTP 401'
  });
});

test('buildStructuredLog normalizes primitive responseSummary into an object', () => {
  const structuredLog = Logger.buildStructuredLog({
    timestamp: '2026-04-15T02:29:31.690+00:00',
    level: 'warn',
    message: '',
    loggerName: 'bazhuayu.mcp.http',
    meta: {
      responseSummary: 'Session not found or invalid authentication'
    }
  });

  assert.deepEqual(structuredLog.responseSummary, {
    value: 'Session not found or invalid authentication'
  });
});
