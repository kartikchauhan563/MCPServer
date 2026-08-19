import { agentTools, findTool } from './tools.js';
import { getDefaultDbName } from '../agents/mongo/domain.js';
import { getWorkbookPath } from '../agents/excel/domain.js';

export type AgentStep = {
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

export type AgentOutcome = {
  mode: 'llm';
  reply: string;
  steps: AgentStep[];
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

type LlmConfig = {
  apiKey: string;
  model: string;
  chatUrl: string;
};

function resolveLlmConfig(): LlmConfig | null {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) return null;

  const model =
    process.env.LLM_MODEL?.trim() || process.env.IPA_LLM_MODEL?.trim() || '';
  if (!model) return null;

  const explicitUrl = process.env.LLM_API_URL?.trim();
  if (explicitUrl) {
    return { apiKey, model, chatUrl: explicitUrl };
  }

  const base = (
    process.env.LLM_BASE_URL?.trim() ||
    process.env.IPA_OPENAI_BASE_URL?.trim() ||
    'https://api.openai.com/v1'
  ).replace(/\/$/, '');

  if (base.endsWith('/chat/completions')) {
    return { apiKey, model, chatUrl: base };
  }
  if (base.endsWith('/v1')) {
    return { apiKey, model, chatUrl: `${base}/chat/completions` };
  }
  return { apiKey, model, chatUrl: `${base}/v1/chat/completions` };
}

export function isLlmConfigured(): boolean {
  return resolveLlmConfig() !== null;
}

function systemPrompt(): string {
  return [
    'You are a data agent. Convert the user\'s plain-English request into tool calls.',
    `MongoDB default database: ${getDefaultDbName()}.`,
    `Excel workbook file: ${getWorkbookPath()} (row 1 is the header row; data rows start at row 2).`,
    'Choose MongoDB tools (mongo_*) for database/collection requests, and Excel tools (excel_*) for spreadsheet/sheet/row/column requests.',
    'If the user does not name a collection or sheet, inspect first with mongo_list_collections or excel_list_sheets.',
    'To update or delete specific records, read them first so you target the right rows/documents.',
    'When you are done, reply with a short plain-English summary of exactly what changed (include counts and ids).',
  ].join(' ');
}

export async function runWithLlm(prompt: string): Promise<AgentOutcome> {
  const config = resolveLlmConfig();
  if (!config) {
    throw new Error('LLM is not configured. Set LLM_API_KEY and LLM_MODEL (or IPA_* equivalents).');
  }

  const { apiKey, model, chatUrl } = config;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: prompt },
  ];

  const tools = agentTools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  const steps: AgentStep[] = [];
  const maxTurns = 6;

  for (let turn = 0; turn < maxTurns; turn++) {
    // Without a deadline an unreachable endpoint (e.g. an intranet LLM URL used
    // from a cloud host) leaves the HTTP request hanging indefinitely.
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, tools, temperature: 0 }),
      signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 30_000)),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 400)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: ChatMessage }>;
    };
    const message = payload.choices?.[0]?.message;
    if (!message) throw new Error('LLM returned no message');

    messages.push(message);

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      return {
        mode: 'llm',
        reply: message.content?.trim() || 'Done.',
        steps,
      };
    }

    for (const call of calls) {
      const tool = findTool(call.function.name);
      let args: Record<string, unknown> = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }

      if (!tool) {
        const error = `Unknown tool: ${call.function.name}`;
        steps.push({ tool: call.function.name, args, error });
        messages.push({ role: 'tool', tool_call_id: call.id, content: error });
        continue;
      }

      try {
        const result = await tool.run(args);
        steps.push({ tool: tool.name, args, result });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 4000),
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        steps.push({ tool: tool.name, args, error });
        messages.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${error}` });
      }
    }
  }

  return {
    mode: 'llm',
    reply: 'Stopped after too many steps. Try a more specific request.',
    steps,
  };
}
