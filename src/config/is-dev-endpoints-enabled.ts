/**
 * Dev-only API (/dev/*) — только NODE_ENV=development и ENABLE_DEV_ENDPOINTS=true.
 */
export function isDevEndpointsEnabled(
  nodeEnv: string | undefined,
  enableDevEndpoints?: string,
): boolean {
  const flag = (enableDevEndpoints ?? process.env.ENABLE_DEV_ENDPOINTS)?.trim();
  return nodeEnv === 'development' && flag === 'true';
}
