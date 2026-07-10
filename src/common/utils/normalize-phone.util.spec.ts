import {
  formatPhoneDisplay,
  isValidPhone,
  normalizePhone,
} from './normalize-phone.util';

describe('normalizePhone', () => {
  it('normalizes local 9-digit numbers', () => {
    expect(normalizePhone('29 123-45-67')).toBe('375291234567');
  });

  it('keeps full international numbers', () => {
    expect(normalizePhone('+375291234567')).toBe('375291234567');
  });
});

describe('formatPhoneDisplay', () => {
  it('formats normalized phone', () => {
    expect(formatPhoneDisplay('375291234567')).toBe('+375 29 123-45-67');
  });
});

describe('isValidPhone', () => {
  it('accepts belarus numbers', () => {
    expect(isValidPhone('375291234567')).toBe(true);
  });
});
