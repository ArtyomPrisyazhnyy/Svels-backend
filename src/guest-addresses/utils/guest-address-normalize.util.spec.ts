import {
  normalizeRequiredAddressField,
  trimRequiredSnapshotField,
} from './guest-address-normalize.util';

describe('guest-address normalize snapshot', () => {
  it('does not escape quotes or ampersands when trimming snapshot fields', () => {
    expect(trimRequiredSnapshotField(' ул. "Центр" ')).toBe('ул. "Центр"');
    expect(trimRequiredSnapshotField(' 1&2 ')).toBe('1&2');
  });

  it('sanitizeText still applies once for API input fields', () => {
    expect(normalizeRequiredAddressField('a & b')).toBe('a &amp; b');
  });
});
