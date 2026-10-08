/**
 * Dev-only API (например /dev/last-otp) — только при явно заданном NODE_ENV.
 * Без NODE_ENV на сервере считаем production-like (fail-closed).
 */
export function isDevOrTestNodeEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}
