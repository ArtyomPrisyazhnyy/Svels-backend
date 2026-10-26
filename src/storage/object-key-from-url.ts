export interface ObjectKeyFromUrlContext {
  bucket: string;
  publicBaseUrl: string;
  legacyPublicBaseUrls?: string[];
}

function normalizeKey(key: string): string {
  return key.replace(/^\/+/, '');
}

function keyFromPublicBase(url: string, base: string): string | null {
  const normalizedBase = base.replace(/\/$/, '');
  if (!normalizedBase || !url.startsWith(`${normalizedBase}/`)) {
    return null;
  }
  return normalizeKey(url.slice(normalizedBase.length + 1));
}

/**
 * Извлекает ключ объекта из публичного URL.
 * Поддерживает текущий CDN, legacy-базы и типичные S3 URL (path-style и virtual-hosted),
 * в т.ч. ранее сохранённые ссылки на Yandex Object Storage.
 */
export function resolveObjectKeyFromUrl(
  url: string,
  context: ObjectKeyFromUrlContext,
): string | null {
  if (!url) {
    return null;
  }

  const bases = [context.publicBaseUrl, ...(context.legacyPublicBaseUrls ?? [])]
    .map((base) => base.replace(/\/$/, ''))
    .filter(Boolean);

  for (const base of bases) {
    const fromBase = keyFromPublicBase(url, base);
    if (fromBase) {
      return fromBase;
    }
  }

  if (url.startsWith('/uploads/')) {
    return normalizeKey(url.slice('/uploads/'.length));
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/+/, '');

    if (path.startsWith(`${context.bucket}/`)) {
      return normalizeKey(path.slice(context.bucket.length + 1));
    }

    if (parsed.hostname.startsWith(`${context.bucket}.`)) {
      return normalizeKey(path);
    }

    // Legacy Yandex: https://storage.yandexcloud.net/<bucket>/<key>
    if (
      parsed.hostname === 'storage.yandexcloud.net' &&
      path.startsWith(`${context.bucket}/`)
    ) {
      return normalizeKey(path.slice(context.bucket.length + 1));
    }

    // Virtual-hosted на Yandex: https://<bucket>.storage.yandexcloud.net/<key>
    if (parsed.hostname.endsWith('.storage.yandexcloud.net')) {
      const hostBucket = parsed.hostname.replace(
        /\.storage\.yandexcloud\.net$/,
        '',
      );
      if (hostBucket === context.bucket) {
        return normalizeKey(path);
      }
    }
  } catch {
    // ignore invalid URL
  }

  return null;
}
