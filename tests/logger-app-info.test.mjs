import test from 'node:test';
import assert from 'node:assert/strict';

import { Logger } from '../dist/utils/logger.js';
import { RequestContextManager } from '../dist/utils/request-context.js';

// Initialize Logger.appContext before tests run
// In production this is done by Logger.initialize() via AppConfig
Logger.getInstance();

test('buildStructuredLog emits app_info.clientName and app_info.clientVersion from context', () => {
  RequestContextManager.runWithContext(
    {
      requestId: 'req-appinfo-1',
      correlationId: 'corr-appinfo-1',
      startTime: Date.now(),
      clientName: 'Claude Code',
      clientVersion: '1.2.0'
    },
    () => {
      const log = Logger.buildStructuredLog({
        timestamp: '2026-04-20T10:00:00.000+00:00',
        level: 'info',
        message: 'test log',
        loggerName: 'bazhuayu.mcp.http'
      });

      assert.ok(log.app_info, 'app_info field must be present');
      assert.equal(log.app_info.clientName, 'Claude Code');
      assert.equal(log.app_info.clientVersion, '1.2.0');
    }
  );
});

test('buildStructuredLog omits clientName/clientVersion in app_info when not set', () => {
  RequestContextManager.runWithContext(
    {
      requestId: 'req-appinfo-2',
      correlationId: 'corr-appinfo-2',
      startTime: Date.now()
    },
    () => {
      const log = Logger.buildStructuredLog({
        timestamp: '2026-04-20T10:00:00.000+00:00',
        level: 'info',
        message: 'test log',
        loggerName: 'bazhuayu.mcp.http'
      });

      assert.ok(log.app_info, 'app_info field must be present');
      assert.equal(log.app_info.clientName, undefined);
      assert.equal(log.app_info.clientVersion, undefined);
    }
  );
});

test('buildStructuredLog app_info always contains service, version, environment, hostname, pid', () => {
  RequestContextManager.runWithContext(
    {
      requestId: 'req-appinfo-3',
      correlationId: 'corr-appinfo-3',
      startTime: Date.now()
    },
    () => {
      const log = Logger.buildStructuredLog({
        timestamp: '2026-04-20T10:00:00.000+00:00',
        level: 'info',
        message: 'test log',
        loggerName: 'bazhuayu.mcp.http'
      });

      assert.ok(log.app_info.service);
      assert.ok(log.app_info.version);
      assert.ok(log.app_info.environment);
      assert.ok(log.app_info.hostname);
      assert.ok(log.app_info.pid);
    }
  );
});
