import { excelAgentTools } from '../agents/excel/tools.js';
import { mongoAgentTools } from '../agents/mongo/tools.js';
import type { AgentTool } from '../agents/toolHelpers.js';

export type { AgentTool };

export const agentTools: AgentTool[] = [...mongoAgentTools, ...excelAgentTools];

export function findTool(name: string): AgentTool | undefined {
  return agentTools.find((tool) => tool.name === name);
}
