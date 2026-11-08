import { Injectable } from '@nestjs/common';
import type {
  DeliveryPricingHook,
  DeliveryPricingResult,
} from '../pre-orders/interfaces/delivery-pricing-hook.interface';
import type { DeliveryAddressDto } from '../pre-orders/dto/pre-order.dto';
import { roundToKopecks } from '../pre-orders/pricing/round-money.util';
import { throwOrderBusinessError } from '../pre-orders/utils/order-business-error.util';
import { DeliveryZonesService } from './delivery-zones.service';
import { computeDeliveryFee } from './utils/delivery-pricing.util';

@Injectable()
export class DeliveryPricingHookService implements DeliveryPricingHook {
  constructor(private readonly deliveryZonesService: DeliveryZonesService) {}

  async applyForDeliveryOrder(params: {
    restaurantId: string;
    locationId: string | null;
    deliveryAddress: DeliveryAddressDto | null;
    itemsSubtotal: number;
  }): Promise<DeliveryPricingResult> {
    const itemsSubtotal = roundToKopecks(params.itemsSubtotal);
    const hasZones = await this.deliveryZonesService.hasActiveZones(
      params.restaurantId,
      params.locationId ?? undefined,
    );

    if (!hasZones) {
      return {
        itemsSubtotal,
        deliveryFee: 0,
        totalAmount: itemsSubtotal,
        deliveryZoneId: null,
        fulfillmentLocationId: params.locationId,
      };
    }

    const point = this.resolvePoint(params.deliveryAddress);
    if (!point) {
      throwOrderBusinessError(
        'DELIVERY_COORDINATES_REQUIRED',
        'Укажите координаты адреса доставки',
      );
    }

    const match = await this.deliveryZonesService.resolveZoneForPoint(
      params.restaurantId,
      point,
      params.locationId ?? undefined,
    );

    if (!match) {
      throwOrderBusinessError(
        'DELIVERY_OUT_OF_ZONE',
        'Адрес вне зоны доставки',
      );
    }

    const minOrder = Number(match.zone.minOrder);
    if (itemsSubtotal < minOrder) {
      throwOrderBusinessError(
        'DELIVERY_MIN_ORDER',
        `Минимальная сумма заказа для доставки — ${minOrder} BYN`,
      );
    }

    const deliveryFee = computeDeliveryFee(
      itemsSubtotal,
      Number(match.zone.deliveryFee),
      match.zone.freeDeliveryFrom != null
        ? Number(match.zone.freeDeliveryFrom)
        : null,
    );

    return {
      itemsSubtotal,
      deliveryFee,
      totalAmount: roundToKopecks(itemsSubtotal + deliveryFee),
      deliveryZoneId: match.zone.id,
      fulfillmentLocationId: match.location.id,
    };
  }

  private resolvePoint(
    address: DeliveryAddressDto | null,
  ): { lat: number; lng: number } | null {
    if (!address) {
      return null;
    }
    const lat = address.lat;
    const lng = address.lng;
    if (lat == null || lng == null) {
      return null;
    }
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }
    return { lat, lng };
  }
}
