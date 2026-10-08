import { formatLocationLine, inferCityFromAddress } from './infer-city.util';

describe('inferCityFromAddress', () => {
  it('reads city after г.', () => {
    expect(inferCityFromAddress('г. Минск, пр. Независимости 1')).toBe('Минск');
  });

  it('uses the first comma-separated part', () => {
    expect(inferCityFromAddress('Гродно, ул. Советская 10')).toBe('Гродно');
  });
});

describe('formatLocationLine', () => {
  it('prefixes city when it is not already in the address', () => {
    expect(formatLocationLine('Минск', 'ул. Ленина 1')).toBe(
      'Минск, ул. Ленина 1',
    );
  });

  it('does not duplicate city', () => {
    expect(formatLocationLine('Минск', 'г. Минск, ул. Ленина 1')).toBe(
      'г. Минск, ул. Ленина 1',
    );
  });
});
