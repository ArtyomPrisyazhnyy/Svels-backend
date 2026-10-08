import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

let devFallbackKeyWarned = false;

/**
 * AES-256-GCM для секретов мерчантов (bePaid secret key и т.п.).
 * Ключ: BEPAY_CREDENTIALS_ENCRYPTION_KEY (prod) или JWT_SECRET (dev fallback).
 */
function resolveMasterKey(): Buffer {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const encryptionKey = process.env.BEPAY_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (encryptionKey) {
    return createHash('sha256').update(encryptionKey, 'utf8').digest();
  }

  if (nodeEnv === 'production') {
    throw new Error(
      'BEPAY_CREDENTIALS_ENCRYPTION_KEY is required in production',
    );
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  const raw = jwtSecret || 'dev-insecure-bepaid-credentials-key';
  if (!devFallbackKeyWarned) {
    devFallbackKeyWarned = true;
    console.warn(
      '[secret-crypto] BEPAY_CREDENTIALS_ENCRYPTION_KEY is not set; using JWT_SECRET or dev fallback key',
    );
  }
  return createHash('sha256').update(raw, 'utf8').digest();
}

/** Формат: v1:<iv_b64>:<tag_b64>:<ciphertext_b64> */
export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', resolveMasterKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Некорректный формат зашифрованного секрета');
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');

  const decipher = createDecipheriv('aes-256-gcm', resolveMasterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}

export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
