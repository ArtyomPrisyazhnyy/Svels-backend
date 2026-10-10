import { Injectable } from '@nestjs/common';
import type { DeliveryAddressDto } from '../pre-orders/dto/pre-order.dto';
import type { GuestAddressLookup } from '../pre-orders/interfaces/guest-address-lookup.interface';
import { GuestAddressesService } from './guest-addresses.service';

@Injectable()
export class GuestAddressLookupService implements GuestAddressLookup {
  constructor(private readonly guestAddressesService: GuestAddressesService) {}

  findSnapshotForOrder(
    userId: string,
    restaurantId: string,
    addressId: string,
    now: Date = new Date(),
  ): Promise<DeliveryAddressDto | null> {
    return this.guestAddressesService.findSnapshotForOrder(
      userId,
      restaurantId,
      addressId,
      now,
    );
  }

  touchOrSave(params: {
    userId: string;
    restaurantId: string;
    snapshot: DeliveryAddressDto;
    label?: string;
    now: Date;
  }): Promise<void> {
    return this.guestAddressesService.touchOrSave(params);
  }
}
