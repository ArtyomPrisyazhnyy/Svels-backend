import type { DeliveryAddressDto } from '../dto/pre-order.dto';

export interface DeliveryPricingResult {
  itemsSubtotal: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryZoneId: string | null;
  fulfillmentLocationId: string | null;
}

export interface DeliveryPricingHook {
  applyForDeliveryOrder(params: {
    restaurantId: string;
    locationId: string | null;
    deliveryAddress: DeliveryAddressDto | null;
    itemsSubtotal: number;
  }): Promise<DeliveryPricingResult>;
}
