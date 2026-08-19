import 'dotenv/config';

import { getDefaultDbName } from '../agents/mongo/domain.js';
import { closeMongo } from '../shared/db/client.js';
import { resolveHost } from './host.js';
import { createHttpApp } from './server.js';

const port = Number(process.env.PORT || 3000);
const host = resolveHost();

const app = createHttpApp();

const server = app.listen(port, host, () => {
  console.error(`HTTP API + MCP listening on http://${host}:${port}`);
  console.error(`  Health:        GET  /api/health`);
  console.error(`  DB health:     GET  /api/health/db`);
  console.error(`  Login:         POST /api/login`);
  console.error(`  MCP:                /mcp`);
  console.error(`  Default DB:    ${getDefaultDbName()}`);
});

server.on('error', (error) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});

async function shutdown() {
  server.close();
  await closeMongo();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
