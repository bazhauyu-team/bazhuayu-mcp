import test from 'node:test';
import assert from 'node:assert/strict';

import { RequestContextManager } from '../dist/utils/request-context.js';
import { Logger } from '../dist/utils/logger.js';

test('updateContext preserves request and correlation ids while enriching request fields', () => {
  const startTime = Date.now();

  RequestContextManager.runWithContext(
    {
      requestId: 'req-1',
      correlationId: 'corr-1',
      method: 'GET',
      url: '/original',
      startTime
    },
    () => {
      RequestContextManager.updateContext({
        userId: 'user-1',
        username: 'alice',
        sessionId: 'session-1',
        authType: 'jwt'
      });

      const context = RequestContextManager.getContext();
      const logOptions = RequestContextManager.getLogOptions();

      assert.equal(context?.requestId, 'req-1');
      assert.equal(context?.correlationId, 'corr-1');
      assert.equal(logOptions.requestId, 'req-1');
      assert.equal(logOptions.correlationId, 'corr-1');
      assert.equal(logOptions.userId, 'user-1');
      assert.equal(logOptions.username, 'alice');
      assert.equal(logOptions.sessionId, 'session-1');
      assert.equal(logOptions.authType, 'jwt');
    }
  );
});

test('setErrorContext stores structured error metadata in the current request context', () => {
  RequestContextManager.runWithContext(
    {
      requestId: 'req-2',
      correlationId: 'corr-2',
      startTime: Date.now()
    },
    () => {
      const error = new Error('request failed');
      error.name = 'RequestFailure';

      RequestContextManager.setErrorContext(error, {
        status: 502,
        code: 'UPSTREAM_FAILURE',
        source: 'handleOAuthAuthorizationServer'
      });

      const errorContext = RequestContextManager.getErrorContext();

      assert.deepEqual(errorContext, {
        name: 'RequestFailure',
        message: 'request failed',
        stack: error.stack,
        status: 502,
        code: 'UPSTREAM_FAILURE',
        source: 'handleOAuthAuthorizationServer'
      });
    }
  );
});

test('buildStructuredLog reads the latest request context at log time', () => {
  RequestContextManager.runWithContext(
    {
      requestId: 'req-3',
      correlationId: 'corr-3',
      method: 'POST',
      url: '/mcp',
      startTime: Date.now()
    },
    () => {
      RequestContextManager.updateContext({
        userId: 'user-3',
        sessionId: 'session-3',
        authType: 'apiKey'
      });

      const structuredLog = Logger.buildStructuredLog({
        timestamp: '2026-04-15T10:00:00.000+00:00',
        level: 'info',
        message: 'request completed',
        loggerName: 'bazhuayu.mcp.http'
      });

      assert.equal(structuredLog.requestId, 'req-3');
      assert.equal(structuredLog.correlationId, 'corr-3');
      assert.equal(structuredLog.userId, 'user-3');
      assert.equal(structuredLog.sessionId, 'session-3');
      assert.equal(structuredLog.authType, 'apiKey');
    }
  );
});

test('buildStructuredLog preserves structured exception objects produced from request error context', () => {
  const structuredLog = Logger.buildStructuredLog({
    timestamp: '2026-04-15T10:05:00.000+00:00',
    level: 'error',
    message: 'request failed',
    loggerName: 'bazhuayu.mcp.http',
    exception: {
      name: 'RequestFailure',
      message: 'upstream timeout',
      stack: 'stack-trace'
    }
  });

  assert.deepEqual(structuredLog.exception, {
    name: 'RequestFailure',
    message: 'upstream timeout',
    stack: 'stack-trace'
  });
});
