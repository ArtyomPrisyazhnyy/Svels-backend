import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import type { DeliveryAddressDto } from '../pre-orders/dto/pre-order.dto';
import type {
  CreateGuestAddressDto,
  GuestAddressDto,
  UpdateGuestAddressDto,
} from './dto/guest-address.dto';
import { GuestAddress } from './entities/guest-address.entity';
import {
  addressDedupeKey,
  normalizeOptionalAddressField,
  normalizeRequiredAddressField,
  snapshotFromEntity,
  trimOptionalSnapshotField,
  trimRequiredSnapshotField,
} from './utils/guest-address-normalize.util';
import {
  throwAddressLimit,
  throwAddressNotFound,
  throwGuestAddressValidation,
} from './utils/guest-address-error.util';
import {
  isWithinGuestAddressFieldLimits,
  type NormalizedGuestAddressFields,
} from './utils/guest-address-limits.util';

const MAX_ADDRESSES_PER_GUEST = 10;

export interface CreateGuestAddressResult {
  dto: GuestAddressDto;
  created: boolean;
}

@Injectable()
export class GuestAddressesService {
  constructor(
    @InjectRepository(GuestAddress)
    private readonly guestAddressRepository: Repository<GuestAddress>,
    private readonly dataSource: DataSource,
  ) {}

  async list(restaurantId: string, userId: string): Promise<GuestAddressDto[]> {
    const rows = await this.guestAddressRepository.find({
      where: { restaurantId, userId },
      order: {
        isDefault: 'DESC',
        lastUsedAt: 'DESC',
        createdAt: 'DESC',
      },
    });

    rows.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      const aLast = a.lastUsedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
      const bLast = b.lastUsedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
      if (aLast !== bLast) {
        return bLast - aLast;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return rows.map((row) => this.toDto(row));
  }

  async create(
    restaurantId: string,
    userId: string,
    dto: CreateGuestAddressDto,
  ): Promise<CreateGuestAddressResult> {
    const normalized = this.normalizeInput(dto);
    this.assertWithinFieldLimits(normalized);

    const duplicate = await this.findDuplicate(
      restaurantId,
      userId,
      normalized.street,
      normalized.house,
      normalized.apartment,
    );
    if (duplicate) {
      return { dto: this.toDto(duplicate), created: false };
    }

    const activeCount = await this.countActive(restaurantId, userId);
    if (activeCount >= MAX_ADDRESSES_PER_GUEST) {
      throwAddressLimit();
    }

    const shouldBeDefault = dto.isDefault === true || activeCount === 0;

    const saved = await this.dataSource.transaction(async (manager) => {
      if (shouldBeDefault) {
        await manager.update(
          GuestAddress,
          { restaurantId, userId, isDefault: true },
          { isDefault: false },
        );
      }

      const entity = manager.create(GuestAddress, {
        restaurantId,
        userId,
        label: normalized.label,
        street: normalized.street,
        house: normalized.house,
        apartment: normalized.apartment,
        entrance: normalized.entrance,
        floor: normalized.floor,
        intercom: normalized.intercom,
        comment: normalized.comment,
        isDefault: shouldBeDefault,
        lastUsedAt: null,
      });

      return manager.save(entity);
    });

    return { dto: this.toDto(saved), created: true };
  }

  async update(
    restaurantId: string,
    userId: string,
    addressId: string,
    dto: UpdateGuestAddressDto,
  ): Promise<GuestAddressDto> {
    const address = await this.findOwnedAddress(
      restaurantId,
      userId,
      addressId,
    );
    if (!address) {
      throwAddressNotFound();
    }

    if (dto.street !== undefined) {
      address.street = normalizeRequiredAddressField(dto.street);
    }
    if (dto.house !== undefined) {
      address.house = normalizeRequiredAddressField(dto.house);
    }
    if (dto.label !== undefined) {
      address.label = normalizeOptionalAddressField(dto.label);
    }
    if (dto.apartment !== undefined) {
      address.apartment = normalizeOptionalAddressField(dto.apartment);
    }
    if (dto.entrance !== undefined) {
      address.entrance = normalizeOptionalAddressField(dto.entrance);
    }
    if (dto.floor !== undefined) {
      address.floor = normalizeOptionalAddressField(dto.floor);
    }
    if (dto.intercom !== undefined) {
      address.intercom = normalizeOptionalAddressField(dto.intercom);
    }
    if (dto.comment !== undefined) {
      address.comment = normalizeOptionalAddressField(dto.comment);
    }

    this.assertWithinFieldLimits({
      label: address.label,
      street: address.street,
      house: address.house,
      apartment: address.apartment,
      entrance: address.entrance,
      floor: address.floor,
      intercom: address.intercom,
      comment: address.comment,
    });

    const saved = await this.dataSource.transaction(async (manager) => {
      if (dto.isDefault === true) {
        await manager.update(
          GuestAddress,
          { restaurantId, userId, isDefault: true },
          { isDefault: false },
        );
        address.isDefault = true;
      } else if (dto.isDefault === false) {
        address.isDefault = false;
      }

      return manager.save(address);
    });

    return this.toDto(saved);
  }

  async remove(
    restaurantId: string,
    userId: string,
    addressId: string,
  ): Promise<void> {
    const address = await this.findOwnedAddress(
      restaurantId,
      userId,
      addressId,
    );
    if (!address) {
      throwAddressNotFound();
    }

    const wasDefault = address.isDefault;

    await this.dataSource.transaction(async (manager) => {
      await manager.softRemove(address);

      if (!wasDefault) {
        return;
      }

      const remaining = await manager.find(GuestAddress, {
        where: { restaurantId, userId },
      });
      remaining.sort((a, b) => {
        const aLast = a.lastUsedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
        const bLast = b.lastUsedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
        if (aLast !== bLast) {
          return bLast - aLast;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      const replacement = remaining[0];

      if (replacement) {
        replacement.isDefault = true;
        await manager.save(replacement);
      }
    });
  }

  async setDefault(
    restaurantId: string,
    userId: string,
    addressId: string,
  ): Promise<GuestAddressDto> {
    const address = await this.findOwnedAddress(
      restaurantId,
      userId,
      addressId,
    );
    if (!address) {
      throwAddressNotFound();
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        GuestAddress,
        { restaurantId, userId, isDefault: true },
        { isDefault: false },
      );
      address.isDefault = true;
      return manager.save(address);
    });

    return this.toDto(saved);
  }

  async findSnapshotForOrder(
    userId: string,
    restaurantId: string,
    addressId: string,
  ): Promise<DeliveryAddressDto | null> {
    const address = await this.findOwnedAddress(
      restaurantId,
      userId,
      addressId,
    );
    if (!address) {
      return null;
    }

    return snapshotFromEntity(address);
  }

  async touchLastUsedAt(
    userId: string,
    restaurantId: string,
    addressId: string,
    now: Date,
  ): Promise<void> {
    const address = await this.findOwnedAddress(
      restaurantId,
      userId,
      addressId,
    );
    if (!address) {
      return;
    }
    address.lastUsedAt = now;
    await this.guestAddressRepository.save(address);
  }

  async touchOrSave(params: {
    userId: string;
    restaurantId: string;
    snapshot: DeliveryAddressDto;
    label?: string;
    now: Date;
  }): Promise<void> {
    const normalized = this.normalizeSnapshot(params.snapshot, params.label);
    if (!isWithinGuestAddressFieldLimits(normalized)) {
      return;
    }

    const duplicate = await this.findDuplicate(
      params.restaurantId,
      params.userId,
      normalized.street,
      normalized.house,
      normalized.apartment,
    );

    if (duplicate) {
      duplicate.lastUsedAt = params.now;
      if (params.label?.trim() && !duplicate.label) {
        duplicate.label = normalized.label;
      }
      await this.guestAddressRepository.save(duplicate);
      return;
    }

    const activeCount = await this.countActive(
      params.restaurantId,
      params.userId,
    );
    if (activeCount >= MAX_ADDRESSES_PER_GUEST) {
      return;
    }

    const shouldBeDefault = activeCount === 0;

    await this.dataSource.transaction(async (manager) => {
      if (shouldBeDefault) {
        await manager.update(
          GuestAddress,
          {
            restaurantId: params.restaurantId,
            userId: params.userId,
            isDefault: true,
          },
          { isDefault: false },
        );
      }

      const entity = manager.create(GuestAddress, {
        restaurantId: params.restaurantId,
        userId: params.userId,
        label: normalized.label,
        street: normalized.street,
        house: normalized.house,
        apartment: normalized.apartment,
        entrance: normalized.entrance,
        floor: normalized.floor,
        intercom: normalized.intercom,
        comment: normalized.comment,
        isDefault: shouldBeDefault,
        lastUsedAt: params.now,
      });

      await manager.save(entity);
    });
  }

  private async findOwnedAddress(
    restaurantId: string,
    userId: string,
    addressId: string,
  ): Promise<GuestAddress | null> {
    return this.guestAddressRepository.findOne({
      where: { id: addressId, restaurantId, userId },
    });
  }

  private async countActive(
    restaurantId: string,
    userId: string,
  ): Promise<number> {
    return this.guestAddressRepository.count({
      where: { restaurantId, userId, deletedAt: IsNull() },
    });
  }

  private async findDuplicate(
    restaurantId: string,
    userId: string,
    street: string,
    house: string,
    apartment: string | null,
  ): Promise<GuestAddress | null> {
    const key = addressDedupeKey(street, house, apartment);
    const rows = await this.guestAddressRepository.find({
      where: { restaurantId, userId },
    });
    return (
      rows.find(
        (row) => addressDedupeKey(row.street, row.house, row.apartment) === key,
      ) ?? null
    );
  }

  private normalizeInput(dto: CreateGuestAddressDto): {
    label: string | null;
    street: string;
    house: string;
    apartment: string | null;
    entrance: string | null;
    floor: string | null;
    intercom: string | null;
    comment: string | null;
  } {
    return {
      label: normalizeOptionalAddressField(dto.label),
      street: normalizeRequiredAddressField(dto.street),
      house: normalizeRequiredAddressField(dto.house),
      apartment: normalizeOptionalAddressField(dto.apartment),
      entrance: normalizeOptionalAddressField(dto.entrance),
      floor: normalizeOptionalAddressField(dto.floor),
      intercom: normalizeOptionalAddressField(dto.intercom),
      comment: normalizeOptionalAddressField(dto.comment),
    };
  }

  private normalizeSnapshot(
    snapshot: DeliveryAddressDto,
    label?: string,
  ): NormalizedGuestAddressFields {
    return {
      label: trimOptionalSnapshotField(label),
      street: trimRequiredSnapshotField(snapshot.street),
      house: trimRequiredSnapshotField(snapshot.house),
      apartment: trimOptionalSnapshotField(snapshot.apartment),
      entrance: trimOptionalSnapshotField(snapshot.entrance),
      floor: trimOptionalSnapshotField(snapshot.floor),
      intercom: trimOptionalSnapshotField(snapshot.intercom),
      comment: trimOptionalSnapshotField(snapshot.comment),
    };
  }

  private assertWithinFieldLimits(fields: NormalizedGuestAddressFields): void {
    if (!isWithinGuestAddressFieldLimits(fields)) {
      throwGuestAddressValidation();
    }
  }

  private toDto(address: GuestAddress): GuestAddressDto {
    return {
      id: address.id,
      label: address.label,
      street: address.street,
      house: address.house,
      apartment: address.apartment,
      entrance: address.entrance,
      floor: address.floor,
      intercom: address.intercom,
      comment: address.comment,
      isDefault: address.isDefault,
      lastUsedAt: address.lastUsedAt?.toISOString() ?? null,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    };
  }
}
