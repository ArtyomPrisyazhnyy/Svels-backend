import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';
import type { ClientConfig } from 'pg';
import type { TlsOptions } from 'tls';

// С этой сети IPv6 до Neon недоступен; Node 20+ иначе сначала ждёт AAAA и ловит ETIMEDOUT.
setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamily(false);

export type PostgresConnectionOptions = {
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: TlsOptions;
};

function shouldUseSsl(host: string, url?: string): boolean {
  const flag = process.env.DB_SSL?.toLowerCase();
  // DATABASE_URL (Neon) всегда через TLS; DB_SSL=false действует только на локальный хост.
  if (url) {
    return true;
  }
  if (flag === 'false' || flag === '0') {
    return false;
  }
  if (flag === 'true' || flag === '1') {
    return true;
  }
  return host !== 'localhost' && host !== '127.0.0.1';
}

function resolveSsl(host: string, url?: string): TlsOptions | undefined {
  if (!shouldUseSsl(host, url)) {
    return undefined;
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

/** Общие параметры Postgres: локальный хост или Neon через DATABASE_URL / DB_*. */
export function resolvePostgresConnection(): PostgresConnectionOptions {
  const url = process.env.DATABASE_URL?.trim() || undefined;
  const host = process.env.DB_HOST ?? 'localhost';

  return {
    url,
    host,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'svels',
    ssl: resolveSsl(host, url),
  };
}

export function toPgClientConfig(): ClientConfig {
  const connection = resolvePostgresConnection();
  if (connection.url) {
    return {
      connectionString: connection.url,
      ssl: connection.ssl,
    };
  }

  return {
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    database: connection.database,
    ssl: connection.ssl,
  };
}
