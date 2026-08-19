import type { AgentDefinition } from './types.js';

/** Discoverable agents for any React / HTTP client. */
export const AGENT_CATALOG: AgentDefinition[] = [
  {
    id: 'agent-1-mongo',
    name: 'Agent 1 · MongoDB',
    description:
      'Create, read, update, and delete MongoDB Atlas documents via plain English or REST/MCP tools.',
    toolsPrefix: 'mongo_',
  },
  {
    id: 'agent-2-excel',
    name: 'Agent 2 · Excel',
    description:
      'Create sheets, add/remove columns, and manage rows in a local .xlsx file via plain English or MCP tools.',
    toolsPrefix: 'excel_',
  },
];

export function getAgentCatalog() {
  return AGENT_CATALOG;
}
