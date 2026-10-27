import { computeDeliveryFee } from './delivery-pricing.util';

describe('computeDeliveryFee', () => {
  it('returns zone fee when below free threshold', () => {
    expect(computeDeliveryFee(20, 5, 50)).toBe(5);
  });

  it('returns zero when subtotal meets free delivery threshold', () => {
    expect(computeDeliveryFee(50, 5, 50)).toBe(0);
    expect(computeDeliveryFee(60, 5, 50)).toBe(0);
  });

  it('returns zone fee when free threshold is null', () => {
    expect(computeDeliveryFee(100, 3.5, null)).toBe(3.5);
  });
});
