import { createHmac, timingSafeEqual } from 'crypto';

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export type InitDataCheck =
  | { ok: true; user: TelegramWebAppUser | null; authDate: number }
  | { ok: false; reason: 'invalid' | 'expired' };

const FUTURE_SKEW_SEC = 60;

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  nowMs: number,
  maxAgeSec = 86400,
): InitDataCheck {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (hash === null) {
    return { ok: false, reason: 'invalid' };
  }

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const withoutHash = entriesWithout(params, ['hash']);
  const withoutHashAndSignature = entriesWithout(params, ['hash', 'signature']);

  const signatureMatches =
    isSameHex(hash, signHex(secretKey, withoutHash)) ||
    (params.has('signature') &&
      isSameHex(hash, signHex(secretKey, withoutHashAndSignature)));
  if (!signatureMatches) {
    return { ok: false, reason: 'invalid' };
  }

  const rawAuthDate = params.get('auth_date');
  const authDate = rawAuthDate === null ? NaN : Number(rawAuthDate);
  if (
    rawAuthDate === null ||
    rawAuthDate.trim() === '' ||
    !Number.isFinite(authDate)
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const nowSec = nowMs / 1000;
  if (nowSec - authDate > maxAgeSec || authDate - nowSec > FUTURE_SKEW_SEC) {
    return { ok: false, reason: 'expired' };
  }

  const rawUser = params.get('user');
  if (rawUser === null) {
    return { ok: true, user: null, authDate };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawUser);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const user =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as TelegramWebAppUser)
      : null;
  return { ok: true, user, authDate };
}

function entriesWithout(
  params: URLSearchParams,
  excludedKeys: string[],
): string {
  return [...params.entries()]
    .filter(([key]) => !excludedKeys.includes(key))
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function signHex(secretKey: Buffer, dataCheckString: string): string {
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

function isSameHex(received: string, expected: string): boolean {
  const left = Buffer.from(received, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
