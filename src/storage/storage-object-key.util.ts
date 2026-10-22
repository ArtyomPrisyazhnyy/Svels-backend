const UPLOADS_PREFIX = '/uploads/';
const LEGACY_YANDEX_HOST = 'storage.yandexcloud.net';

export type StorageDriver = 'local' | 's3';

export function normalizeStorageKey(key: string): string {
  return key
    .trim()
    .replace(/^\/+/, '')
    .replace(/^uploads\//, '');
}

export function buildPublicMediaUrl(
  driver: StorageDriver,
  key: string,
  publicBaseUrl: string,
): string {
  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) {
    return '';
  }

  if (driver === 'local') {
    return `${UPLOADS_PREFIX}${normalizedKey}`;
  }

  const base = publicBaseUrl.replace(/\/$/, '');
  return `${base}/${normalizedKey}`;
}

export function extractObjectKeyFromValue(
  value: string,
  options: {
    publicBaseUrl?: string;
    bucket?: string;
  } = {},
): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '';
  }

  if (!trimmed.includes('://') && !trimmed.startsWith(UPLOADS_PREFIX)) {
    return normalizeStorageKey(trimmed);
  }

  if (trimmed.startsWith(UPLOADS_PREFIX)) {
    return normalizeStorageKey(trimmed.slice(UPLOADS_PREFIX.length));
  }

  const publicBase = options.publicBaseUrl?.replace(/\/$/, '');
  if (publicBase && trimmed.startsWith(`${publicBase}/`)) {
    return normalizeStorageKey(trimmed.slice(publicBase.length + 1));
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === LEGACY_YANDEX_HOST) {
      const path = parsed.pathname.replace(/^\/+/, '');
      const bucket = options.bucket?.trim();
      if (bucket && path.startsWith(`${bucket}/`)) {
        return normalizeStorageKey(path.slice(bucket.length + 1));
      }
      const slash = path.indexOf('/');
      if (slash > 0) {
        return normalizeStorageKey(path.slice(slash + 1));
      }
    }

    if (options.bucket && parsed.hostname.startsWith(`${options.bucket}.`)) {
      return normalizeStorageKey(parsed.pathname.replace(/^\/+/, ''));
    }

    const pathOnly = parsed.pathname.replace(/^\/+/, '');
    if (options.bucket && pathOnly.startsWith(`${options.bucket}/`)) {
      return normalizeStorageKey(pathOnly.slice(options.bucket.length + 1));
    }

    return normalizeStorageKey(pathOnly);
  } catch {
    return normalizeStorageKey(trimmed);
  }
}

export function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
