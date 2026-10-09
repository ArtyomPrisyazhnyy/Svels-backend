/**
 * Fastify trustProxy: доверяем только loopback/private сетям (Caddy в Docker),
 * чтобы клиент не подделывал IP через X-Forwarded-For.
 * TRUST_PROXY=false отключает; true — доверять всем (не для production).
 */
export const DEFAULT_TRUST_PROXY = 'loopback, linklocal, uniquelocal';

export function resolveTrustProxy(
  raw: string | undefined = process.env.TRUST_PROXY,
): string | boolean {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return DEFAULT_TRUST_PROXY;
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  return trimmed;
}
