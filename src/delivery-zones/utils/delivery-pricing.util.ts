import { roundToKopecks } from '../../pre-orders/pricing/round-money.util';

export function computeDeliveryFee(
  itemsSubtotal: number,
  zoneDeliveryFee: number,
  freeDeliveryFrom: number | null,
): number {
  if (freeDeliveryFrom != null && itemsSubtotal >= freeDeliveryFrom) {
    return 0;
  }
  return roundToKopecks(zoneDeliveryFee);
}
