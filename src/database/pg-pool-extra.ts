const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

export function resolvePgPoolExtra(): {
  connectionTimeoutMillis: number;
  keepAlive: boolean;
} {
  const raw = process.env.DB_CONNECTION_TIMEOUT_MS?.trim();
  let connectionTimeoutMillis = DEFAULT_CONNECTION_TIMEOUT_MS;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      connectionTimeoutMillis = parsed;
    }
  }

  return {
    connectionTimeoutMillis,
    keepAlive: true,
  };
}
