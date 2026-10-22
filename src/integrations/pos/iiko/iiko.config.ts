export const IIKO_POS_CONFIG_KEY = 'iikoPos';

export interface IikoPosConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  /** Legacy v1: apiLogin (ранее «API-ключ» в старых инструкциях). */
  apiLogin?: string;
  /** Auth v2 */
  apiKey?: string;
  appId?: string;
  clientSecret?: string;
}

export function readIikoPosConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): IikoPosConfig {
  const enabled =
    (env.IIKO_POS_ENABLED ?? 'false').toLowerCase() === 'true' ||
    (env.IIKO_POS_ENABLED ?? '') === '1';

  return {
    enabled,
    baseUrl: env.IIKO_API_BASE_URL?.trim() || 'https://api-ru.iiko.services',
    timeoutMs: Number(env.IIKO_TIMEOUT_MS ?? 30_000),
    apiLogin: env.IIKO_API_LOGIN?.trim() || env.IIKO_API_KEY?.trim(),
    apiKey: env.IIKO_API_KEY?.trim(),
    appId: env.IIKO_APP_ID?.trim(),
    clientSecret: env.IIKO_CLIENT_SECRET?.trim(),
  };
}

export function isIikoAuthConfigured(config: IikoPosConfig): boolean {
  const v2 =
    Boolean(config.apiKey) &&
    Boolean(config.appId) &&
    Boolean(config.clientSecret);
  const v1 = Boolean(config.apiLogin);
  return v2 || v1;
}
