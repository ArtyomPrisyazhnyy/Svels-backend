import {
  formatPhoneDisplay,
  getPhoneCountry,
  isValidPhone,
  maskPhone,
  normalizePhone,
  toE164,
} from './normalize-phone.util';

describe('normalizePhone', () => {
  it('normalizes local BY 9-digit numbers', () => {
    expect(normalizePhone('29 123-45-67')).toBe('375291234567');
  });

  it('keeps full BY international numbers', () => {
    expect(normalizePhone('+375291234567')).toBe('375291234567');
  });

  it('normalizes BY 80… prefix', () => {
    expect(normalizePhone('80291234567')).toBe('375291234567');
  });

  it('normalizes RU +7', () => {
    expect(normalizePhone('+7 999 123-45-67')).toBe('79991234567');
  });

  it('normalizes RU 8… prefix', () => {
    expect(normalizePhone('89991234567')).toBe('79991234567');
  });

  it('normalizes RU 10-digit mobile', () => {
    expect(normalizePhone('9991234567')).toBe('79991234567');
  });
});

describe('formatPhoneDisplay', () => {
  it('formats BY phone', () => {
    expect(formatPhoneDisplay('375291234567')).toBe('+375 29 123-45-67');
  });

  it('formats RU phone', () => {
    expect(formatPhoneDisplay('79991234567')).toBe('+7 999 123-45-67');
  });
});

describe('maskPhone', () => {
  it('masks BY phone', () => {
    expect(maskPhone('375291234567')).toBe('+375 29 ***-**-67');
  });

  it('masks RU phone', () => {
    expect(maskPhone('79991234567')).toBe('+7 999 ***-**-67');
  });
});

describe('isValidPhone / getPhoneCountry / toE164', () => {
  it('accepts belarus and russia numbers', () => {
    expect(isValidPhone('375291234567')).toBe(true);
    expect(isValidPhone('79991234567')).toBe(true);
    expect(getPhoneCountry('375291234567')).toBe('BY');
    expect(getPhoneCountry('79991234567')).toBe('RU');
    expect(toE164('375291234567')).toBe('+375291234567');
  });
});
