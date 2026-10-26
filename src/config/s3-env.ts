export type StorageDriver = 'local' | 's3';

export interface ResolvedS3Env {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
  /** Дополнительные базовые URL (например, старый Yandex CDN), для resolveKeyFromUrl. */
  legacyPublicBaseUrls: string[];
}

function readEnv(name: string, legacyNames: string[] = []): string {
  const direct = process.env[name];
  if (direct !== undefined && direct !== '') {
    return direct;
  }
  for (const legacy of legacyNames) {
    const value = process.env[legacy];
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  return '';
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseLegacyPublicBaseUrls(): string[] {
  const raw =
    process.env.S3_LEGACY_PUBLIC_BASE_URLS ??
    process.env.YANDEX_STORAGE_PUBLIC_BASE_URL ??
    '';
  const fromList = raw
    .split(',')
    .map((part) => part.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const bucket = readEnv('S3_BUCKET', ['YANDEX_STORAGE_BUCKET']);
  const legacyEndpoint = readEnv('S3_LEGACY_ENDPOINT', [
    'YANDEX_STORAGE_ENDPOINT',
  ]);
  if (
    bucket &&
    legacyEndpoint &&
    !fromList.some((url) => url.includes(bucket))
  ) {
    fromList.push(`${legacyEndpoint.replace(/\/$/, '')}/${bucket}`);
  }

  return [...new Set(fromList)];
}

export function resolveStorageDriver(): StorageDriver {
  const raw = (process.env.STORAGE_DRIVER ?? 'local').trim().toLowerCase();
  if (raw === 's3' || raw === 'yandex') {
    return 's3';
  }
  return 'local';
}

/** Параметры S3 для приложения (S3_* с fallback на устаревшие YANDEX_*). */
export function resolveAppS3Env(): ResolvedS3Env {
  const bucket = readEnv('S3_BUCKET', ['YANDEX_STORAGE_BUCKET']);
  const publicBaseUrl = readEnv('S3_PUBLIC_BASE_URL', [
    'YANDEX_STORAGE_PUBLIC_BASE_URL',
  ]).replace(/\/$/, '');

  const forcePathStyle =
    process.env.S3_FORCE_PATH_STYLE !== undefined
      ? parseBool(process.env.S3_FORCE_PATH_STYLE, true)
      : parseBool(process.env.YANDEX_STORAGE_FORCE_PATH_STYLE, true);

  return {
    bucket,
    accessKeyId: readEnv('S3_ACCESS_KEY_ID', ['YANDEX_STORAGE_ACCESS_KEY_ID']),
    secretAccessKey: readEnv('S3_SECRET_ACCESS_KEY', [
      'YANDEX_STORAGE_SECRET_ACCESS_KEY',
    ]),
    region: readEnv('S3_REGION', ['YANDEX_STORAGE_REGION']),
    endpoint: readEnv('S3_ENDPOINT', ['YANDEX_STORAGE_ENDPOINT']),
    publicBaseUrl,
    forcePathStyle,
    legacyPublicBaseUrls: parseLegacyPublicBaseUrls(),
  };
}

export interface ResolvedSrcS3Env {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
}

/** Источник для `storage:migrate` (SRC_S3_* или устаревшие YANDEX_*). */
export function resolveSrcS3Env(): ResolvedSrcS3Env {
  const bucket = readEnv('SRC_S3_BUCKET', ['YANDEX_STORAGE_BUCKET']);
  const publicBaseUrl = readEnv('SRC_S3_PUBLIC_BASE_URL', [
    'YANDEX_STORAGE_PUBLIC_BASE_URL',
  ]).replace(/\/$/, '');

  const forcePathStyle =
    process.env.SRC_S3_FORCE_PATH_STYLE !== undefined
      ? parseBool(process.env.SRC_S3_FORCE_PATH_STYLE, true)
      : parseBool(process.env.YANDEX_STORAGE_FORCE_PATH_STYLE, true);

  return {
    bucket,
    accessKeyId: readEnv('SRC_S3_ACCESS_KEY_ID', [
      'YANDEX_STORAGE_ACCESS_KEY_ID',
    ]),
    secretAccessKey: readEnv('SRC_S3_SECRET_ACCESS_KEY', [
      'YANDEX_STORAGE_SECRET_ACCESS_KEY',
    ]),
    region: readEnv('SRC_S3_REGION', ['YANDEX_STORAGE_REGION']),
    endpoint: readEnv('SRC_S3_ENDPOINT', ['YANDEX_STORAGE_ENDPOINT']),
    forcePathStyle,
    publicBaseUrl,
  };
}

export function createS3ClientConfig(env: {
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}): {
  region: string;
  endpoint?: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
  forcePathStyle: boolean;
} {
  return {
    region: env.region || 'us-east-1',
    endpoint: env.endpoint || undefined,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    forcePathStyle: env.forcePathStyle,
  };
}
