import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';

import { getAgentCatalog } from '../agents/catalog.js';
import { createMcpServer } from '../mcp/createMcpServer.js';
import { extractApiKey, getConfiguredApiKey } from './auth.js';
import { createApiRouter } from './routes.js';

function parseCorsOrigins(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGIN?.trim() || '*';
  if (raw === '*') return true;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function createHttpApp() {
  const host =
    process.env.HTTP_HOST?.trim() ||
    (process.env.RENDER || process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

  const app = createMcpExpressApp({
    host,
    allowedHosts:
      host === '0.0.0.0' || host === '::'
        ? undefined
        : [host, 'localhost', '127.0.0.1'].filter(Boolean),
    allowedOrigins:
      host === '0.0.0.0' || host === '::' ? undefined : ['localhost', '127.0.0.1'],
  });

  app.use(
    cors({
      origin: parseCorsOrigins(),
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Accept'],
    }),
  );

  app.get('/', (_req, res) => {
    res.json({
      name: 'demo-mcp-server',
      version: '2.0.0',
      description: 'Headless MCP server for any React (or other) client',
      agents: getAgentCatalog(),
      endpoints: {
        login: 'POST /api/login',
        health: 'GET /api/health',
        agents: 'GET /api/agents',
        naturalLanguage: 'POST /api/agent',
        rest: '/api/*',
        mcp: '/mcp',
      },
      connectFromReact: {
        step1: 'POST /api/login with { apiKey }',
        step2: 'Use returned token as Authorization: Bearer <token>',
        step3: 'Call /api/agent or /mcp, or REST CRUD under /api',
      },
    });
  });

  app.use('/api', createApiRouter());

  const mcpHandler = createMcpHandler(createMcpServer);
  const node = toNodeHandler(mcpHandler);

  app.all('/mcp', (req, res) => {
    const expected = getConfiguredApiKey();
    if (expected) {
      const provided = extractApiKey(req);
      if (!provided || provided !== expected) {
        res.status(401).json({ error: 'Unauthorized — send Authorization: Bearer <CLIENT_API_KEY>' });
        return;
      }
    }
    void node(req, res, req.body);
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api]', message);
    res.status(500).json({ error: message });
  });

  return app;
}
