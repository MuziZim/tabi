#!/usr/bin/env node

/**
 * Remote MCP server for Tabi — exposes the travel planning tools over HTTP.
 *
 * Supports two transports for maximum client compatibility:
 *   - Streamable HTTP (POST /mcp)  — new MCP standard (2025-03-26+)
 *   - SSE (GET /sse, POST /messages) — legacy transport for older clients
 *
 * Usage:
 *   MCP_API_KEY=secret npm run serve
 *
 * Then add in Claude mobile → Settings → Integrations → MCP:
 *   URL: https://your-host.example.com/sse   (or /mcp for streamable)
 */

import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { loadEnv, createMcpServer } from './server.js';

loadEnv();

const PORT = parseInt(process.env.MCP_PORT || '3001', 10);
const API_KEY = process.env.MCP_API_KEY;

// ---- Express App ----

const app = express();
app.use(express.json());

// ---- CORS ----

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// ---- Auth Middleware ----

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!API_KEY) {
    // No key configured — allow all (development mode)
    next();
    return;
  }

  const provided =
    req.headers['x-api-key'] as string ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  if (provided !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized — provide x-api-key header or Bearer token' });
    return;
  }

  next();
}

// ---- Health Check ----

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', server: 'tabi-mcp', transport: ['streamable-http', 'sse'] });
});

// ======================================================================
// Streamable HTTP Transport (new standard — POST /mcp)
// ======================================================================

// Each session gets its own server + transport
const streamableSessions = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', requireAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Existing session
  if (sessionId && streamableSessions.has(sessionId)) {
    const transport = streamableSessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — create server + transport
  const newSessionId = randomUUID();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => newSessionId,
  });

  streamableSessions.set(newSessionId, transport);

  // Clean up on close
  transport.onclose = () => {
    streamableSessions.delete(newSessionId);
  };

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Handle GET for SSE stream on /mcp (Streamable HTTP spec)
app.get('/mcp', requireAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !streamableSessions.has(sessionId)) {
    res.status(400).json({ error: 'Missing or invalid session ID. POST to /mcp first.' });
    return;
  }

  const transport = streamableSessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// Handle DELETE for session termination
app.delete('/mcp', requireAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !streamableSessions.has(sessionId)) {
    res.status(400).json({ error: 'Missing or invalid session ID.' });
    return;
  }

  const transport = streamableSessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// ======================================================================
// Legacy SSE Transport (GET /sse + POST /messages)
// ======================================================================

const sseSessions = new Map<string, SSEServerTransport>();

app.get('/sse', requireAuth, async (req: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  sseSessions.set(transport.sessionId, transport);

  transport.onclose = () => {
    sseSessions.delete(transport.sessionId);
  };

  const server = createMcpServer();
  await server.connect(transport);
});

app.post('/messages', requireAuth, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseSessions.get(sessionId);

  if (!transport) {
    res.status(400).json({ error: 'Unknown session — connect to /sse first' });
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

// ---- Start ----

app.listen(PORT, () => {
  console.log(`Tabi MCP remote server listening on http://localhost:${PORT}`);
  console.log(`  Streamable HTTP: POST http://localhost:${PORT}/mcp`);
  console.log(`  Legacy SSE:      GET  http://localhost:${PORT}/sse`);
  console.log(`  Health:          GET  http://localhost:${PORT}/health`);
  if (!API_KEY) {
    console.log('  ⚠️  No MCP_API_KEY set — running without auth (dev mode)');
  }
});
