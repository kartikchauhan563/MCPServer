import { isLlmConfigured, runWithLlm, type AgentStep } from './llm.js';
import { runWithRules } from './rules.js';

export type AgentResponse = {
  mode: 'llm' | 'rules';
  prompt: string;
  reply: string;
  steps: AgentStep[];
  /** Set when the LLM was configured but unusable, so the client can explain. */
  notice?: string;
};

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Undici surfaces DNS/connection failures as a bare "fetch failed".
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|certificate/i.test(message)) {
    return 'the LLM endpoint is unreachable from this server';
  }
  if (/timeout|aborted|AbortError/i.test(message)) {
    return 'the LLM endpoint timed out';
  }
  return message;
}

export async function runAgent(prompt: string): Promise<AgentResponse> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error('prompt is required');

  if (isLlmConfigured()) {
    try {
      const outcome = await runWithLlm(trimmed);
      return { mode: outcome.mode, prompt: trimmed, reply: outcome.reply, steps: outcome.steps };
    } catch (error) {
      // A broken LLM shouldn't take the whole agent down: keyword mode still
      // performs real work, so degrade instead of returning a 500.
      const reason = describe(error);
      console.error(`[agent] LLM failed (${reason}); falling back to keyword mode.`);
      const outcome = await runWithRules(trimmed);
      return {
        mode: outcome.mode,
        prompt: trimmed,
        reply: outcome.reply,
        steps: outcome.steps,
        notice: `Natural-language mode is unavailable because ${reason}. Answered in keyword mode instead.`,
      };
    }
  }

  const outcome = await runWithRules(trimmed);
  return { mode: outcome.mode, prompt: trimmed, reply: outcome.reply, steps: outcome.steps };
}

export { isLlmConfigured };
