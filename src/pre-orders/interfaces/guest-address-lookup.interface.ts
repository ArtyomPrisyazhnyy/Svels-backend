import type { DeliveryAddressDto } from '../dto/pre-order.dto';

export interface GuestAddressLookup {
  findSnapshotForOrder(
    userId: string,
    restaurantId: string,
    addressId: string,
  ): Promise<DeliveryAddressDto | null>;

  touchLastUsedAt(
    userId: string,
    restaurantId: string,
    addressId: string,
    now: Date,
  ): Promise<void>;

  touchOrSave(params: {
    userId: string;
    restaurantId: string;
    snapshot: DeliveryAddressDto;
    label?: string;
    now: Date;
  }): Promise<void>;
}
