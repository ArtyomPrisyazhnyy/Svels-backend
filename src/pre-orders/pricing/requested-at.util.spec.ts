import { parseRequestedAt } from './requested-at.util';

describe('parseRequestedAt', () => {
  const now = Date.parse('2026-06-01T12:00:00.000Z');

  it('allows null for asap', () => {
    expect(parseRequestedAt(null, now)).toBeNull();
    expect(parseRequestedAt(undefined, now)).toBeNull();
  });

  it('rejects too soon and too late', () => {
    expect(() => parseRequestedAt('2026-06-01T12:05:00.000Z', now)).toThrow();
    expect(() => parseRequestedAt('2026-06-05T12:00:00.000Z', now)).toThrow();
  });

  it('accepts within 10 minutes to 2 days window', () => {
    const value = parseRequestedAt('2026-06-02T12:00:00.000Z', now);
    expect(value).toBeInstanceOf(Date);
  });
});
