import 'dotenv/config';

import { getDefaultDbName } from '../agents/mongo/domain.js';
import { closeMongo } from '../shared/db/client.js';
import { createHttpApp } from './server.js';

const port = Number(process.env.PORT || 3000);
const host =
  process.env.HTTP_HOST?.trim() ||
  (process.env.RENDER || process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

const app = createHttpApp();

const server = app.listen(port, host, () => {
  console.error(`HTTP API + MCP listening on http://${host}:${port}`);
  console.error(`  Login:         POST http://${host}:${port}/api/login`);
  console.error(`  REST / NL:     http://${host}:${port}/api`);
  console.error(`  MCP:           http://${host}:${port}/mcp`);
  console.error(`  Default DB:    ${getDefaultDbName()}`);
});

async function shutdown() {
  server.close();
  await closeMongo();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
