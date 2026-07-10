import { isValidDomain, normalizeDomain } from './normalize-domain.util';

describe('normalizeDomain', () => {
  it('lowercases and strips www', () => {
    expect(normalizeDomain('WWW.MoonTea.BY')).toBe('moontea.by');
  });

  it('strips port', () => {
    expect(normalizeDomain('moontea.by:443')).toBe('moontea.by');
  });

  it('extracts hostname from URL', () => {
    expect(normalizeDomain('https://moontea.by/menu')).toBe('moontea.by');
  });
});

describe('isValidDomain', () => {
  it('accepts valid hostnames', () => {
    expect(isValidDomain('moontea.by')).toBe(true);
    expect(isValidDomain('cafe.example.com')).toBe(true);
  });

  it('rejects invalid hostnames', () => {
    expect(isValidDomain('localhost')).toBe(false);
    expect(isValidDomain('not a domain')).toBe(false);
  });
});
