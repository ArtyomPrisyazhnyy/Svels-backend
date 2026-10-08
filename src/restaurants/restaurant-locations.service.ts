import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { sanitizeText } from '../common/utils/sanitize.util';
import { NextRevalidationService } from '../next-revalidation/next-revalidation.service';
import {
  CreateRestaurantLocationDto,
  RestaurantLocationResponseDto,
  UpdateRestaurantLocationDto,
} from './dto/restaurant-location.dto';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantLocation } from './entities/restaurant-location.entity';
import { geocodeAddress } from './utils/geocode.util';
import { formatLocationLine, inferCityFromAddress } from './utils/infer-city.util';

const DEFAULT_POINT = { lat: 53.9023, lng: 27.5619 };

@Injectable()
export class RestaurantLocationsService {
  constructor(
    @InjectRepository(RestaurantLocation)
    private readonly locationRepository: Repository<RestaurantLocation>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    private readonly cacheService: CacheService,
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  async getByRestaurant(restaurantId: string): Promise<RestaurantLocationResponseDto[]> {
    await this.ensureRestaurant(restaurantId);
    await this.ensureSeeded(restaurantId);

    const cached = await this.cacheService.get<RestaurantLocationResponseDto[]>(
      CacheKeys.restaurantLocations(restaurantId),
    );
    if (cached) {
      return cached;
    }

    const locations = await this.locationRepository.find({
      where: { restaurantId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const response = locations.map((location) => this.toResponse(location));
    await this.cacheService.set(CacheKeys.restaurantLocations(restaurantId), response);
    return response;
  }

  async create(
    restaurantId: string,
    dto: CreateRestaurantLocationDto,
  ): Promise<RestaurantLocationResponseDto> {
    await this.ensureRestaurant(restaurantId);

    const location = this.locationRepository.create({
      restaurantId,
      city: sanitizeText(dto.city),
      address: sanitizeText(dto.address),
      label: this.normalizeLabel(dto.label),
      lat: dto.lat,
      lng: dto.lng,
      sortOrder: dto.sortOrder ?? 0,
    });

    const saved = await this.locationRepository.save(location);
    await this.syncPrimaryAddress(restaurantId);
    await this.afterMutate(restaurantId);
    return this.toResponse(saved);
  }

  async update(
    restaurantId: string,
    locationId: string,
    dto: UpdateRestaurantLocationDto,
  ): Promise<RestaurantLocationResponseDto> {
    const location = await this.findOwned(restaurantId, locationId);

    if (dto.city !== undefined) {
      location.city = sanitizeText(dto.city);
    }
    if (dto.address !== undefined) {
      location.address = sanitizeText(dto.address);
    }
    if (dto.label !== undefined) {
      location.label = this.normalizeLabel(dto.label);
    }
    if (dto.lat !== undefined) {
      location.lat = dto.lat;
    }
    if (dto.lng !== undefined) {
      location.lng = dto.lng;
    }
    if (dto.sortOrder !== undefined) {
      location.sortOrder = dto.sortOrder;
    }

    const saved = await this.locationRepository.save(location);
    await this.syncPrimaryAddress(restaurantId);
    await this.afterMutate(restaurantId);
    return this.toResponse(saved);
  }

  async remove(restaurantId: string, locationId: string): Promise<void> {
    const location = await this.findOwned(restaurantId, locationId);
    const count = await this.locationRepository.count({ where: { restaurantId } });
    if (count <= 1) {
      throw new BadRequestException('Нужна хотя бы одна точка с адресом');
    }

    await this.locationRepository.remove(location);
    await this.syncPrimaryAddress(restaurantId);
    await this.afterMutate(restaurantId);
  }

  async geocode(query: string): Promise<{ lat: number; lng: number }> {
    const point = await geocodeAddress(sanitizeText(query));
    if (!point) {
      throw new NotFoundException('Адрес не найден на карте. Поставьте метку вручную.');
    }
    return point;
  }

  /** Одна точка на каждый адрес заявки — после approve. */
  async seedFromRegistration(
    restaurantId: string,
    rows: Array<{ city?: string; label?: string; address: string }>,
  ): Promise<void> {
    const existing = await this.locationRepository.count({ where: { restaurantId } });
    if (existing > 0) {
      return;
    }

    for (const [index, row] of rows.entries()) {
      const address = sanitizeText(row.address);
      const city = row.city?.trim()
        ? sanitizeText(row.city)
        : inferCityFromAddress(address);
      const point =
        (await geocodeAddress(`${city}, ${address}`)) ?? DEFAULT_POINT;

      await this.locationRepository.save(
        this.locationRepository.create({
          restaurantId,
          city,
          address,
          label: this.normalizeLabel(row.label),
          lat: point.lat,
          lng: point.lng,
          sortOrder: index,
        }),
      );
    }

    await this.syncPrimaryAddress(restaurantId);
    await this.afterMutate(restaurantId);
  }

  private async ensureSeeded(restaurantId: string): Promise<void> {
    const count = await this.locationRepository.count({ where: { restaurantId } });
    if (count > 0) {
      return;
    }

    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant?.address?.trim()) {
      return;
    }

    const address = sanitizeText(restaurant.address);
    const city = inferCityFromAddress(address);
    const point = (await geocodeAddress(address)) ?? DEFAULT_POINT;

    await this.locationRepository.save(
      this.locationRepository.create({
        restaurantId,
        city,
        address,
        label: null,
        lat: point.lat,
        lng: point.lng,
        sortOrder: 0,
      }),
    );
    await this.afterMutate(restaurantId);
  }

  private async syncPrimaryAddress(restaurantId: string): Promise<void> {
    const first = await this.locationRepository.findOne({
      where: { restaurantId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    if (!first) {
      return;
    }

    await this.restaurantRepository.update(
      { id: restaurantId },
      { address: formatLocationLine(first.city, first.address) },
    );
  }

  private async afterMutate(restaurantId: string): Promise<void> {
    await this.cacheService.del(CacheKeys.restaurantLocations(restaurantId));
    await this.nextRevalidationService.revalidateRestaurantPublicPage(restaurantId);
  }

  private async ensureRestaurant(restaurantId: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }
    return restaurant;
  }

  private async findOwned(
    restaurantId: string,
    locationId: string,
  ): Promise<RestaurantLocation> {
    const location = await this.locationRepository.findOne({
      where: { id: locationId, restaurantId },
    });
    if (!location) {
      throw new NotFoundException('Точка не найдена');
    }
    return location;
  }

  private toResponse(location: RestaurantLocation): RestaurantLocationResponseDto {
    return {
      id: location.id,
      restaurantId: location.restaurantId,
      city: location.city,
      address: location.address,
      label: location.label,
      lat: location.lat,
      lng: location.lng,
      sortOrder: location.sortOrder,
    };
  }

  private normalizeLabel(label?: string | null): string | null {
    if (label === null || label === undefined) {
      return null;
    }
    const trimmed = label.trim();
    return trimmed ? sanitizeText(trimmed) : null;
  }
}
