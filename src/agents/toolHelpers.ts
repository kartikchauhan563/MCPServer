export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

export function str(args: Record<string, unknown>, key: string, required = true): string {
  const value = args[key];
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (required) throw new Error(`Missing required argument: ${key}`);
  return '';
}

export function obj(
  args: Record<string, unknown>,
  key: string,
  required = true,
): Record<string, unknown> {
  const value = args[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }
  if (required) throw new Error(`Argument ${key} must be a JSON object`);
  return {};
}

export function num(args: Record<string, unknown>, key: string, fallback?: number): number {
  const value = args[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required numeric argument: ${key}`);
}

export const objectSchema = { type: 'object', additionalProperties: true } as const;
