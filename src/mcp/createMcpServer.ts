import { McpServer } from '@modelcontextprotocol/server';

import { getDefaultDbName } from '../agents/mongo/domain.js';
import { registerExcelAgent } from '../agents/excel/mcp.js';
import { registerMongoAgent } from '../agents/mongo/mcp.js';

/** Composes Agent 1 (Mongo) + Agent 2 (Excel) for stdio and HTTP MCP. */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'demo-mcp-server',
      version: '2.0.0',
    },
    {
      instructions: [
        'This MCP server hosts multiple agents.',
        'Agent 1 (mongo_*): MongoDB Atlas create/read/update/delete. Default DB: ' +
          getDefaultDbName() +
          '.',
        'Agent 2 (excel_*): local Excel workbook — sheets, rows, columns.',
        'Map plain-English requests to the matching agent tools.',
        'Inspect with mongo_list_collections or excel_list_sheets when the target is unclear.',
      ].join(' '),
    },
  );

  registerMongoAgent(server);
  registerExcelAgent(server);

  return server;
}
