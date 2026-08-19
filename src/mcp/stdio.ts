import 'dotenv/config';

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { getDefaultDbName } from '../agents/mongo/domain.js';
import { createMcpServer } from './createMcpServer.js';

void serveStdio(createMcpServer);
console.error(
  `demo-mcp-server (stdio) — default db: ${getDefaultDbName()}`,
);
