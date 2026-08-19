const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function isProductionHost(): boolean {
  return Boolean(process.env.RENDER) || process.env.NODE_ENV === 'production';
}

/**
 * Resolves the bind address.
 *
 * On hosts like Render the process must bind 0.0.0.0 to receive traffic, so a
 * loopback HTTP_HOST is ignored there instead of silently making the service
 * unreachable.
 */
export function resolveHost(): string {
  const configured = process.env.HTTP_HOST?.trim();

  if (isProductionHost()) {
    if (configured && !LOOPBACK.has(configured)) return configured;
    return '0.0.0.0';
  }

  return configured || '127.0.0.1';
}

export function isWildcardHost(host: string): boolean {
  return host === '0.0.0.0' || host === '::';
}
