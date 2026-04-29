import test from 'node:test';
import assert from 'node:assert/strict';

import { RequestContextManager } from '../dist/utils/request-context.js';

test('getLogOptions returns clientName and clientVersion from context', () => {
  RequestContextManager.runWithContext(
    {
      requestId: 'req-client-1',
      correlationId: 'corr-client-1',
      startTime: Date.now()
    },
    () => {
      RequestContextManager.updateContext({
        clientName: 'Claude Code',
        clientVersion: '1.2.0'
      });

      const logOptions = RequestContextManager.getLogOptions();

      assert.equal(logOptions.clientName, 'Claude Code');
      assert.equal(logOptions.clientVersion, '1.2.0');
    }
  );
});

test('getLogOptions returns undefined for clientName/clientVersion when not set', () => {
  RequestContextManager.runWithContext(
    {
      requestId: 'req-client-2',
      correlationId: 'corr-client-2',
      startTime: Date.now()
    },
    () => {
      const logOptions = RequestContextManager.getLogOptions();

      assert.equal(logOptions.clientName, undefined);
      assert.equal(logOptions.clientVersion, undefined);
    }
  );
});
