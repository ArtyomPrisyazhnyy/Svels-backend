import { createHmac } from 'crypto';
import { validateTelegramInitData } from './telegram-init-data.util';

const BOT_TOKEN = '123:TEST';
const NOW_MS = Date.UTC(2026, 9, 9, 12, 0, 0);
const NOW_SEC = NOW_MS / 1000;

function signFields(
  fields: Record<string, string>,
  options: { excludeSignature?: boolean; botToken?: string } = {},
): string {
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(options.botToken ?? BOT_TOKEN)
    .digest();
  const excluded = options.excludeSignature ? ['signature'] : [];
  const dataCheckString = Object.entries(fields)
    .filter(([key]) => !excluded.includes(key))
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const hash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

function validFields(overrides: Record<string, string> = {}) {
  return {
    auth_date: String(NOW_SEC - 60),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({ id: 42, first_name: 'Ivan', username: 'ivan' }),
    ...overrides,
  };
}

describe('validateTelegramInitData', () => {
  it('accepts a correctly signed payload and returns the user', () => {
    const initData = signFields(validFields());

    const result = validateTelegramInitData(initData, BOT_TOKEN, NOW_MS);

    expect(result).toEqual({
      ok: true,
      user: { id: 42, first_name: 'Ivan', username: 'ivan' },
      authDate: NOW_SEC - 60,
    });
  });

  it('rejects a payload whose signed field was changed', () => {
    const initData = signFields(validFields()).replace('Ivan', 'Petr');

    expect(validateTelegramInitData(initData, BOT_TOKEN, NOW_MS)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects a payload without hash', () => {
    const initData = new URLSearchParams(validFields()).toString();

    expect(validateTelegramInitData(initData, BOT_TOKEN, NOW_MS)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects a payload signed with another bot token', () => {
    const initData = signFields(validFields(), { botToken: '999:OTHER' });

    expect(validateTelegramInitData(initData, BOT_TOKEN, NOW_MS)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects auth_date older than 24 hours as expired', () => {
    const initData = signFields(
      validFields({ auth_date: String(NOW_SEC - 25 * 3600) }),
    );

    expect(validateTelegramInitData(initData, BOT_TOKEN, NOW_MS)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects auth_date more than 60 seconds in the future as expired', () => {
    const initData = signFields(
      validFields({ auth_date: String(NOW_SEC + 300) }),
    );

    expect(validateTelegramInitData(initData, BOT_TOKEN, NOW_MS)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('accepts a payload that carries a signature field signed without it', () => {
    const fields = { ...validFields(), signature: 'ZmFrZS1zaWduYXR1cmU' };
    const initData = signFields(fields, { excludeSignature: true });

    const result = validateTelegramInitData(initData, BOT_TOKEN, NOW_MS);

    expect(result.ok).toBe(true);
    expect(result.ok && result.user?.id).toBe(42);
  });

  it('rejects malformed JSON in user', () => {
    const initData = signFields(validFields({ user: '{bad json' }));

    expect(validateTelegramInitData(initData, BOT_TOKEN, NOW_MS)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
