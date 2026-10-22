import {
  type IikoPosConfig,
  isIikoAuthConfigured,
  readIikoPosConfigFromEnv,
} from './iiko.config';
import { IikoApiError, IikoNotConfiguredError } from './iiko.errors';

export interface IikoHttpClientOptions {
  config?: IikoPosConfig;
  fetchImpl?: typeof fetch;
}

interface AccessTokenState {
  token: string;
  expiresAtMs: number;
}

function trimBearer(token: string): string {
  return token.startsWith('Bearer ') ? token.slice(7) : token;
}

function decodeJwtExpMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { exp?: number };
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

export class IikoHttpClient {
  private readonly config: IikoPosConfig;
  private readonly fetchImpl: typeof fetch;
  private tokenState: AccessTokenState | null = null;

  constructor(options: IikoHttpClientOptions = {}) {
    this.config = options.config ?? readIikoPosConfigFromEnv();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getConfig(): IikoPosConfig {
    return this.config;
  }

  isConfigured(): boolean {
    return this.config.enabled && isIikoAuthConfigured(this.config);
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!isIikoAuthConfigured(this.config)) {
      throw new IikoNotConfiguredError(
        'Задайте IIKO_API_KEY + IIKO_APP_ID + IIKO_CLIENT_SECRET (v2) или IIKO_API_LOGIN (legacy v1)',
      );
    }

    if (
      !forceRefresh &&
      this.tokenState &&
      this.tokenState.expiresAtMs > Date.now() + 60_000
    ) {
      return this.tokenState.token;
    }

    const useV2 =
      Boolean(this.config.apiKey) &&
      Boolean(this.config.appId) &&
      Boolean(this.config.clientSecret);

    if (useV2) {
      const response = await this.postJson<{
        token?: string;
        correlationId?: string;
        errorDescription?: string;
        error?: string;
      }>(
        '/api/v2/access_token',
        {
          apiKey: this.config.apiKey,
          appId: this.config.appId,
          clientSecret: this.config.clientSecret,
        },
        { skipAuth: true },
      );

      if (!response.token) {
        throw new IikoApiError(
          response.errorDescription ?? 'iiko v2 auth: token missing',
          401,
          response.correlationId,
          response.error,
          response,
        );
      }

      const expMs =
        decodeJwtExpMs(response.token) ?? Date.now() + 55 * 60 * 1000;
      this.tokenState = { token: response.token, expiresAtMs: expMs };
      return response.token;
    }

    const legacy = await this.postJson<{
      token?: string;
      correlationId?: string;
      errorDescription?: string;
      error?: string;
    }>(
      '/api/1/access_token',
      { apiLogin: this.config.apiLogin },
      {
        skipAuth: true,
      },
    );

    if (!legacy.token) {
      throw new IikoApiError(
        legacy.errorDescription ?? 'iiko v1 auth: token missing',
        401,
        legacy.correlationId,
        legacy.error,
        legacy,
      );
    }

    this.tokenState = {
      token: trimBearer(legacy.token),
      expiresAtMs: Date.now() + 55 * 60 * 1000,
    };
    return this.tokenState.token;
  }

  async postApi<T>(
    path: string,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    return this.postJson<T>(path, body);
  }

  private async postJson<T>(
    path: string,
    body: Record<string, unknown>,
    options: { skipAuth?: boolean } = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!options.skipAuth) {
      const token = await this.getAccessToken();
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = { rawText: text };
      }
    }

    if (!response.ok) {
      const errBody = parsed as {
        correlationId?: string;
        errorDescription?: string;
        error?: string;
      };
      throw new IikoApiError(
        errBody.errorDescription ?? `iiko HTTP ${response.status} for ${path}`,
        response.status,
        errBody.correlationId,
        errBody.error,
        parsed,
      );
    }

    return parsed as T;
  }

  async fetchOrganizations(): Promise<unknown> {
    return this.postApi('/api/1/organizations', {});
  }

  async fetchTerminalGroups(organizationIds: string[]): Promise<unknown> {
    return this.postApi('/api/1/terminal_groups', {
      organizationIds,
    });
  }

  async fetchNomenclature(organizationId: string): Promise<unknown> {
    return this.postApi('/api/1/nomenclature', { organizationId });
  }

  async fetchExternalMenus(): Promise<unknown> {
    return this.postApi('/api/2/menu', {});
  }

  async fetchExternalMenuById(params: {
    externalMenuId: string;
    organizationIds: string[];
    version?: number;
  }): Promise<unknown> {
    const version = params.version ?? 3;
    if (version >= 3) {
      return this.postApi('/api/menu/v3/by_id', {
        externalMenuId: params.externalMenuId,
        organizationIds: params.organizationIds,
        version: 3,
      });
    }
    return this.postApi('/api/2/menu/by_id', {
      externalMenuId: params.externalMenuId,
      organizationIds: params.organizationIds,
      version: 2,
    });
  }

  async fetchStopLists(organizationIds: string[]): Promise<unknown> {
    return this.postApi('/api/1/stop_lists', { organizationIds });
  }

  async createDelivery(body: Record<string, unknown>): Promise<unknown> {
    return this.postApi('/api/1/deliveries/create', body);
  }

  async fetchDeliveriesById(
    organizationId: string,
    orderIds: string[],
  ): Promise<unknown> {
    return this.postApi('/api/1/deliveries/by_id', {
      organizationId,
      orderIds,
    });
  }

  async fetchCommandStatus(correlationId: string): Promise<unknown> {
    return this.postApi('/api/1/commands/status', { correlationId });
  }
}
