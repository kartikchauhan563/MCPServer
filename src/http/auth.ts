import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    clientId?: string;
  }
}

export function getConfiguredApiKey(): string {
  return process.env.CLIENT_API_KEY?.trim() || process.env.API_KEY?.trim() || '';
}

export function extractApiKey(req: Request): string {
  const header = req.header('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const xKey = req.header('x-api-key');
  if (xKey) return xKey.trim();
  if (typeof req.body?.apiKey === 'string') return req.body.apiKey.trim();
  if (typeof req.query.apiKey === 'string') return req.query.apiKey.trim();
  return '';
}

/** Protects API routes so any React app must login with CLIENT_API_KEY. */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = getConfiguredApiKey();
  if (!expected) {
    // Dev-friendly: if no key configured, allow all (but warn once).
    next();
    return;
  }

  const provided = extractApiKey(req);
  if (!provided || provided !== expected) {
    res.status(401).json({
      error: 'Unauthorized',
      hint: 'POST /api/login with { "apiKey": "..." } or send Authorization: Bearer <key>',
    });
    return;
  }

  req.clientId = 'react-client';
  next();
}
