import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { sanitizeText } from '../common/utils/sanitize.util';
import { RestaurantLocation } from '../restaurants/entities/restaurant-location.entity';
import {
  CreateDeliveryZoneDto,
  DeliveryQuoteResponseDto,
  DeliveryZoneResponseDto,
  UpdateDeliveryZoneDto,
} from './dto/delivery-zone.dto';
import { DeliveryZone } from './entities/delivery-zone.entity';
import { DeliveryZoneType } from './enums/delivery-zone-type.enum';
import {
  type GeoPoint,
  isPointInGeoJsonPolygon,
  isPointInRadiusZone,
} from './utils/delivery-geo.util';
import { computeDeliveryFee } from './utils/delivery-pricing.util';
import { assertValidZoneGeometry } from './utils/delivery-zone-validate.util';

type LocationPoint = { id: string; lat: number; lng: number };

@Injectable()
export class DeliveryZonesService {
  constructor(
    @InjectRepository(DeliveryZone)
    private readonly zoneRepository: Repository<DeliveryZone>,
    @InjectRepository(RestaurantLocation)
    private readonly locationRepository: Repository<RestaurantLocation>,
  ) {}

  async listByLocation(
    restaurantId: string,
    locationId: string,
  ): Promise<DeliveryZoneResponseDto[]> {
    await this.ensureLocation(restaurantId, locationId);
    const zones = await this.zoneRepository.find({
      where: { restaurantId, locationId },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
    return zones.map((zone) => this.toResponse(zone));
  }

  async create(
    restaurantId: string,
    locationId: string,
    dto: CreateDeliveryZoneDto,
  ): Promise<DeliveryZoneResponseDto> {
    await this.ensureLocation(restaurantId, locationId);
    assertValidZoneGeometry(dto.type, dto.radiusMeters, dto.polygon);

    const zone = this.zoneRepository.create({
      restaurantId,
      locationId,
      name: sanitizeText(dto.name.trim()),
      type: dto.type,
      radiusMeters:
        dto.type === DeliveryZoneType.RADIUS ? dto.radiusMeters! : null,
      polygon:
        dto.type === DeliveryZoneType.POLYGON ? dto.polygon! : null,
      deliveryFee: dto.deliveryFee.toFixed(2),
      minOrder: dto.minOrder.toFixed(2),
      freeDeliveryFrom:
        dto.freeDeliveryFrom != null
          ? dto.freeDeliveryFrom.toFixed(2)
          : null,
      isActive: dto.isActive ?? true,
      priority: dto.priority ?? 0,
    });

    const saved = await this.zoneRepository.save(zone);
    return this.toResponse(saved);
  }

  async update(
    restaurantId: string,
    locationId: string,
    zoneId: string,
    dto: UpdateDeliveryZoneDto,
  ): Promise<DeliveryZoneResponseDto> {
    const zone = await this.findOwnedZone(restaurantId, locationId, zoneId);
    const nextType = dto.type ?? zone.type;

    if (dto.name !== undefined) {
      zone.name = sanitizeText(dto.name.trim());
    }
    if (dto.type !== undefined) {
      zone.type = dto.type;
    }
    if (dto.radiusMeters !== undefined) {
      zone.radiusMeters = dto.radiusMeters;
    }
    if (dto.polygon !== undefined) {
      zone.polygon = dto.polygon;
    }
    if (dto.deliveryFee !== undefined) {
      zone.deliveryFee = dto.deliveryFee.toFixed(2);
    }
    if (dto.minOrder !== undefined) {
      zone.minOrder = dto.minOrder.toFixed(2);
    }
    if (dto.freeDeliveryFrom !== undefined) {
      zone.freeDeliveryFrom =
        dto.freeDeliveryFrom != null
          ? dto.freeDeliveryFrom.toFixed(2)
          : null;
    }
    if (dto.isActive !== undefined) {
      zone.isActive = dto.isActive;
    }
    if (dto.priority !== undefined) {
      zone.priority = dto.priority;
    }

    if (nextType === DeliveryZoneType.RADIUS) {
      zone.polygon = null;
    } else if (nextType === DeliveryZoneType.POLYGON) {
      zone.radiusMeters = null;
    }

    assertValidZoneGeometry(
      nextType,
      zone.radiusMeters,
      zone.polygon,
    );

    const saved = await this.zoneRepository.save(zone);
    return this.toResponse(saved);
  }

  async remove(
    restaurantId: string,
    locationId: string,
    zoneId: string,
  ): Promise<void> {
    const zone = await this.findOwnedZone(restaurantId, locationId, zoneId);
    await this.zoneRepository.remove(zone);
  }

  async quote(
    restaurantId: string,
    point: GeoPoint,
    locationId?: string,
    itemsSubtotal = 0,
  ): Promise<DeliveryQuoteResponseDto> {
    const match = await this.resolveZoneForPoint(
      restaurantId,
      point,
      locationId,
    );

    if (!match) {
      const hasActive = await this.hasActiveZones(restaurantId, locationId);
      if (!hasActive) {
        return {
          status: 'out_of_zone',
          zone: null,
          deliveryFee: null,
          minOrder: null,
          freeDeliveryFrom: null,
        };
      }
      return {
        status: 'out_of_zone',
        zone: null,
        deliveryFee: null,
        minOrder: null,
        freeDeliveryFrom: null,
      };
    }

    const deliveryFee = computeDeliveryFee(
      itemsSubtotal,
      Number(match.zone.deliveryFee),
      match.zone.freeDeliveryFrom != null
        ? Number(match.zone.freeDeliveryFrom)
        : null,
    );

    return {
      status: 'in_zone',
      zone: {
        id: match.zone.id,
        locationId: match.zone.locationId,
        name: match.zone.name,
        deliveryFee,
        minOrder: Number(match.zone.minOrder),
        freeDeliveryFrom:
          match.zone.freeDeliveryFrom != null
            ? Number(match.zone.freeDeliveryFrom)
            : null,
      },
      deliveryFee,
      minOrder: Number(match.zone.minOrder),
      freeDeliveryFrom:
        match.zone.freeDeliveryFrom != null
          ? Number(match.zone.freeDeliveryFrom)
          : null,
    };
  }

  async hasActiveZones(
    restaurantId: string,
    locationId?: string,
  ): Promise<boolean> {
    const where = locationId
      ? { restaurantId, locationId, isActive: true }
      : { restaurantId, isActive: true };
    const count = await this.zoneRepository.count({ where });
    return count > 0;
  }

  async resolveZoneForPoint(
    restaurantId: string,
    point: GeoPoint,
    locationId?: string,
  ): Promise<{ zone: DeliveryZone; location: LocationPoint } | null> {
    const zones = await this.zoneRepository.find({
      where: {
        restaurantId,
        isActive: true,
        ...(locationId ? { locationId } : {}),
      },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });

    if (!zones.length) {
      return null;
    }

    const locationIds = [...new Set(zones.map((z) => z.locationId))];
    const locations = await this.locationRepository.find({
      where: { restaurantId, id: In(locationIds) },
    });
    const locationById = new Map(
      locations.map((l) => [
        l.id,
        { id: l.id, lat: l.lat, lng: l.lng } satisfies LocationPoint,
      ]),
    );

    for (const zone of zones) {
      const location = locationById.get(zone.locationId);
      if (!location) {
        continue;
      }
      if (this.isPointInZone(point, zone, location)) {
        return { zone, location };
      }
    }

    return null;
  }

  isPointInZone(
    point: GeoPoint,
    zone: DeliveryZone,
    location: LocationPoint,
  ): boolean {
    if (zone.type === DeliveryZoneType.RADIUS) {
      if (zone.radiusMeters == null) {
        return false;
      }
      return isPointInRadiusZone(
        point,
        { lat: location.lat, lng: location.lng },
        zone.radiusMeters,
      );
    }

    if (!zone.polygon) {
      return false;
    }
    return isPointInGeoJsonPolygon(point, zone.polygon);
  }

  private async findOwnedZone(
    restaurantId: string,
    locationId: string,
    zoneId: string,
  ): Promise<DeliveryZone> {
    await this.ensureLocation(restaurantId, locationId);
    const zone = await this.zoneRepository.findOne({
      where: { id: zoneId, restaurantId, locationId },
    });
    if (!zone) {
      throw new NotFoundException('Зона доставки не найдена');
    }
    return zone;
  }

  private async ensureLocation(
    restaurantId: string,
    locationId: string,
  ): Promise<RestaurantLocation> {
    const location = await this.locationRepository.findOne({
      where: { id: locationId, restaurantId },
    });
    if (!location) {
      throw new NotFoundException('Точка заведения не найдена');
    }
    return location;
  }

  private toResponse(zone: DeliveryZone): DeliveryZoneResponseDto {
    return {
      id: zone.id,
      locationId: zone.locationId,
      name: zone.name,
      type: zone.type,
      radiusMeters: zone.radiusMeters,
      polygon: zone.polygon,
      deliveryFee: Number(zone.deliveryFee),
      minOrder: Number(zone.minOrder),
      freeDeliveryFrom:
        zone.freeDeliveryFrom != null ? Number(zone.freeDeliveryFrom) : null,
      isActive: zone.isActive,
      priority: zone.priority,
      createdAt: zone.createdAt.toISOString(),
      updatedAt: zone.updatedAt.toISOString(),
    };
  }
}
