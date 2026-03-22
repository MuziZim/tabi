#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadEnv, createMcpServer } from './server.js';

loadEnv();

const server = createMcpServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Tabi MCP server running (stdio)');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
