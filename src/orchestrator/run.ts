import { isLlmConfigured, runWithLlm, type AgentStep } from './llm.js';
import { runWithRules } from './rules.js';

export type AgentResponse = {
  mode: 'llm' | 'rules';
  prompt: string;
  reply: string;
  steps: AgentStep[];
};

export async function runAgent(prompt: string): Promise<AgentResponse> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error('prompt is required');

  if (isLlmConfigured()) {
    const outcome = await runWithLlm(trimmed);
    return { mode: outcome.mode, prompt: trimmed, reply: outcome.reply, steps: outcome.steps };
  }

  const outcome = await runWithRules(trimmed);
  return { mode: outcome.mode, prompt: trimmed, reply: outcome.reply, steps: outcome.steps };
}

export { isLlmConfigured };
