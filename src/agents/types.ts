import type { McpServer } from '@modelcontextprotocol/server';

export function toolError(error: unknown): {
  content: [{ type: 'text'; text: string }];
  isError: true;
} {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

export function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

export type AgentDefinition = {
  id: string;
  name: string;
  description: string;
  toolsPrefix: string;
};

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

export type RegisterAgent = (server: McpServer) => void;
