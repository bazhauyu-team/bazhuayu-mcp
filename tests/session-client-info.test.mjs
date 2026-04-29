import test from 'node:test';
import assert from 'node:assert/strict';

test('SessionMetadata with clientInfo survives JSON round-trip', () => {
  const metadata = {
    userId: 'user-1',
    userInfo: { userId: 'user-1', username: 'alice', email: 'alice@example.com', scope: 'read' },
    createdAt: 1713000000000,
    lastSeen: 1713001000000,
    toolSelection: { includeTools: [], excludeTools: [], resolvedToolNames: [] },
    clientCapabilities: {
      sampling: {},
      elicitation: {},
      roots: {
        listChanged: true
      },
      tasks: {
        list: {},
        cancel: {},
        requests: {
          sampling: {
            createMessage: {}
          },
          elicitation: {
            create: {}
          }
        }
      }
    },
    clientInfo: {
      name: 'Claude Code',
      version: '1.2.0'
    }
  };

  const serialized = JSON.stringify(metadata);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.clientInfo.name, 'Claude Code');
  assert.equal(parsed.clientInfo.version, '1.2.0');
  assert.equal(parsed.clientCapabilities.tasks.requests.sampling.createMessage !== undefined, true);
  assert.equal(parsed.clientCapabilities.tasks.requests.elicitation.create !== undefined, true);
  assert.equal(parsed.clientCapabilities.roots.listChanged, true);
  assert.equal(parsed.userId, 'user-1');
});

test('SessionMetadata without clientInfo still works (backward compat)', () => {
  const metadata = {
    userId: 'user-2',
    createdAt: 1713000000000
  };

  const serialized = JSON.stringify(metadata);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.clientInfo, undefined);
  assert.equal(parsed.userId, 'user-2');
});
