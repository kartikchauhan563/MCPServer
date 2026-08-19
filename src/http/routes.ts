import { Router, type Request, type Response, type NextFunction } from 'express';

import fs from 'node:fs';

import { getAgentCatalog } from '../agents/catalog.js';
import * as excel from '../agents/excel/domain.js';
import { getExcelShareUrl, getWorkbookPath } from '../agents/excel/domain.js';
import * as docs from '../agents/mongo/domain.js';
import { isMongoConfigured } from '../shared/db/client.js';
import { extractApiKey, getConfiguredApiKey, requireApiKey } from './auth.js';
import { isLlmConfigured, runAgent } from '../orchestrator/run.js';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

function param(value: string | string[] | undefined, name: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) throw new Error(`Missing path param: ${name}`);
  return raw;
}

export function createApiRouter(): Router {
  const router = Router();

  /**
   * Public liveness — must never touch Mongo, otherwise an unreachable cluster
   * makes the whole service look dead to platform health checks.
   */
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      mongoConfigured: isMongoConfigured(),
      authRequired: Boolean(getConfiguredApiKey()),
      llm: isLlmConfigured() ? 'llm' : 'rules',
      excel: {
        file: getWorkbookPath(),
        shareUrl: getExcelShareUrl(),
      },
    });
  });

  /** Public readiness — actually pings Mongo, with a bounded response. */
  router.get(
    '/health/db',
    asyncHandler(async (_req, res) => {
      if (!isMongoConfigured()) {
        res.status(503).json({ status: 'error', error: 'MONGODB_URI is not set' });
        return;
      }
      try {
        res.json({ status: 'ok', mongo: await docs.ping() });
      } catch (error) {
        res.status(503).json({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  /**
   * Login for any React (or other) client.
   * Body: { "apiKey": "<CLIENT_API_KEY>" }
   * Returns a bearer token (same key) + agent catalog.
   */
  router.post('/login', (req, res) => {
    const expected = getConfiguredApiKey();
    const provided =
      (typeof req.body?.apiKey === 'string' && req.body.apiKey.trim()) || extractApiKey(req);

    if (!expected) {
      res.json({
        ok: true,
        warning: 'CLIENT_API_KEY is not set on the server — auth is disabled.',
        token: null,
        agents: getAgentCatalog(),
        endpoints: {
          mcp: '/mcp',
          agent: '/api/agent',
          rest: '/api',
        },
      });
      return;
    }

    if (!provided || provided !== expected) {
      res.status(401).json({ error: 'Invalid apiKey' });
      return;
    }

    res.json({
      ok: true,
      token: provided,
      tokenType: 'Bearer',
      agents: getAgentCatalog(),
      endpoints: {
        mcp: '/mcp',
        agent: '/api/agent',
        rest: '/api',
      },
      usage: {
        header: 'Authorization: Bearer <token>',
        or: 'x-api-key: <token>',
      },
    });
  });

  router.use(requireApiKey);

  router.get('/agents', (_req, res) => {
    res.json({ agents: getAgentCatalog() });
  });

  /** Metadata about the workbook the Excel agent actually edits. */
  router.get(
    '/excel/info',
    asyncHandler(async (_req, res) => {
      res.json(await excel.getInfo());
    }),
  );

  /** Downloads the live .xlsx the agent edits, so users see their real data. */
  router.get('/excel/download', (_req, res) => {
    const filePath = getWorkbookPath();
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Workbook has not been created yet. Add data first.' });
      return;
    }
    res.download(filePath, 'workbook.xlsx', (error) => {
      if (error && !res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  router.get('/agent', (_req, res) => {
    res.json({
      mode: isLlmConfigured() ? 'llm' : 'rules',
      hint: isLlmConfigured()
        ? 'Full natural-language mode via configured LLM.'
        : 'Keyword mode. Set LLM_API_KEY and LLM_MODEL for full natural language.',
      agents: getAgentCatalog(),
    });
  });

  router.post(
    '/agent',
    asyncHandler(async (req, res) => {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
      if (!prompt.trim()) {
        res.status(400).json({ error: 'prompt is required' });
        return;
      }
      res.json(await runAgent(prompt));
    }),
  );

  router.get(
    '/databases',
    asyncHandler(async (_req, res) => {
      res.json({ databases: await docs.listDatabases() });
    }),
  );

  router.get(
    '/collections',
    asyncHandler(async (req, res) => {
      const database = typeof req.query.database === 'string' ? req.query.database : undefined;
      res.json(await docs.listCollections(database));
    }),
  );

  router.post(
    '/:collection/find',
    asyncHandler(async (req, res) => {
      const collection = param(req.params.collection, 'collection');
      const { database, filter, limit, sort } = req.body ?? {};
      res.json(await docs.findDocuments({ collection, database, filter, limit, sort }));
    }),
  );

  router.post(
    '/:collection/count',
    asyncHandler(async (req, res) => {
      const collection = param(req.params.collection, 'collection');
      const { database, filter } = req.body ?? {};
      res.json(await docs.countDocuments({ collection, database, filter }));
    }),
  );

  router.post(
    '/:collection',
    asyncHandler(async (req, res) => {
      const collection = param(req.params.collection, 'collection');
      const { database, document, documents } = req.body ?? {};
      if (documents) {
        res.status(201).json(await docs.insertMany({ collection, database, documents }));
        return;
      }
      if (!document) {
        res.status(400).json({ error: 'Provide document or documents in body' });
        return;
      }
      res.status(201).json(await docs.insertOne({ collection, database, document }));
    }),
  );

  router.patch(
    '/:collection',
    asyncHandler(async (req, res) => {
      const collection = param(req.params.collection, 'collection');
      const { database, filter, update, upsert, many } = req.body ?? {};
      if (!filter || !update) {
        res.status(400).json({ error: 'filter and update are required' });
        return;
      }
      if (many) {
        res.json(await docs.updateMany({ collection, database, filter, update }));
        return;
      }
      res.json(await docs.updateOne({ collection, database, filter, update, upsert }));
    }),
  );

  router.delete(
    '/:collection',
    asyncHandler(async (req, res) => {
      const collection = param(req.params.collection, 'collection');
      const { database, filter, many } = req.body ?? {};
      if (!filter) {
        res.status(400).json({ error: 'filter is required in body' });
        return;
      }
      if (many) {
        res.json(await docs.deleteMany({ collection, database, filter }));
        return;
      }
      res.json(await docs.deleteOne({ collection, database, filter }));
    }),
  );

  return router;
}
