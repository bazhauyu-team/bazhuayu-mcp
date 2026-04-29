import test from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

process.env.CLIENTAPI_BASE_URL = process.env.CLIENTAPI_BASE_URL || 'https://client-api.example.com';
process.env.OFFICIAL_SITE_URL = process.env.OFFICIAL_SITE_URL || 'https://bazhuayu.example.com';

const { createMcpServer } = await import('../dist/server.js');
const { registerTool } = await import('../dist/tools/tool-registry.js');

async function connectClientAndServer(server) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({
    name: 'logging-test-client',
    version: '1.0.0'
  });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    }
  };
}

test('createMcpServer advertises MCP logging capability during initialize', async () => {
  const server = createMcpServer(undefined, undefined, undefined, []);
  const { client, close } = await connectClientAndServer(server);

  try {
    const capabilities = client.getServerCapabilities();
    assert.ok(capabilities.logging);
  } finally {
    await close();
  }
});

test('tool execution emits info-level MCP logs when client enables debug logging', async () => {
  const server = createMcpServer(undefined, undefined, undefined, []);
  registerTool(
    server,
    {
      name: 'demo_logging_tool',
      title: 'Demo logging tool',
      description: 'Returns a demo payload',
      requiresAuth: false,
      inputSchema: z.object({}),
      handler: async () => ({ ok: true })
    },
    async () => undefined
  );

  const notifications = [];
  const { client, close } = await connectClientAndServer(server);

  try {
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      notifications.push(notification.params);
    });

    await client.setLoggingLevel('debug');
    await client.callTool({
      name: 'demo_logging_tool',
      arguments: {}
    });

    assert.equal(notifications.length, 2);
    assert.deepEqual(
      notifications.map((entry) => entry.logger),
      ['bazhuayu.mcp.tool', 'bazhuayu.mcp.tool']
    );
    assert.equal(notifications.some((entry) => String(entry.data).includes('Starting tool: demo_logging_tool')), true);
    assert.equal(notifications.some((entry) => String(entry.data).includes('Tool succeeded: demo_logging_tool')), true);
  } finally {
    await close();
  }
});

test('warning log level suppresses info tool logs but still receives error logs', async () => {
  const server = createMcpServer(undefined, undefined, undefined, []);
  registerTool(
    server,
    {
      name: 'failing_logging_tool',
      title: 'Failing logging tool',
      description: 'Throws a demo error',
      requiresAuth: false,
      inputSchema: z.object({}),
      handler: async () => {
        throw new Error('simulated failure');
      }
    },
    async () => undefined
  );

  const notifications = [];
  const { client, close } = await connectClientAndServer(server);
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      notifications.push(notification.params);
    });

    await client.setLoggingLevel('warning');
    const result = await client.callTool({
      name: 'failing_logging_tool',
      arguments: {}
    });

    assert.equal(result.isError, true);
    assert.equal(notifications.some((entry) => String(entry.data).includes('Starting tool: failing_logging_tool')), false);
    assert.equal(notifications.some((entry) => String(entry.data).includes('Tool failed: failing_logging_tool')), true);
  } finally {
    console.error = originalConsoleError;
    await close();
  }
});
