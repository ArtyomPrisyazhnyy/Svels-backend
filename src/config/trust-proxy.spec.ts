import { DEFAULT_TRUST_PROXY, resolveTrustProxy } from './trust-proxy';

describe('resolveTrustProxy', () => {
  it('defaults to private/loopback networks', () => {
    expect(resolveTrustProxy(undefined)).toBe(DEFAULT_TRUST_PROXY);
    expect(resolveTrustProxy('   ')).toBe(DEFAULT_TRUST_PROXY);
  });

  it('supports explicit true/false', () => {
    expect(resolveTrustProxy('true')).toBe(true);
    expect(resolveTrustProxy('false')).toBe(false);
  });

  it('passes through custom trustProxy string', () => {
    expect(resolveTrustProxy('127.0.0.1')).toBe('127.0.0.1');
  });
});
