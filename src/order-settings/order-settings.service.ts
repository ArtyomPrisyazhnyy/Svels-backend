import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys, CacheTtl } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { NextRevalidationService } from '../next-revalidation/next-revalidation.service';
import {
  OrderSettingsResponseDto,
  UpdateOrderSettingsDto,
} from './dto/order-settings.dto';
import { RestaurantOrderSettings } from './entities/restaurant-order-settings.entity';

@Injectable()
export class OrderSettingsService {
  constructor(
    @InjectRepository(RestaurantOrderSettings)
    private readonly settingsRepository: Repository<RestaurantOrderSettings>,
    private readonly cacheService: CacheService,
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  /**
   * Внутренние модули (pre-orders): всегда из БД, без cache-aside —
   * иначе устаревший ordersPaused после паузы или прямого SQL в e2e.
   */
  async getByRestaurant(
    restaurantId: string,
  ): Promise<OrderSettingsResponseDto> {
    const settings = await this.settingsRepository.findOne({
      where: { restaurantId },
    });
    return settings
      ? this.toResponse(settings)
      : this.defaultResponse(restaurantId);
  }

  /** Публичное чтение: без записи в БД, с кэшем. */
  async getPublicByRestaurant(
    restaurantId: string,
  ): Promise<OrderSettingsResponseDto> {
    const cacheKey = CacheKeys.orderSettings(restaurantId);
    const cached =
      await this.cacheService.get<OrderSettingsResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const settings = await this.settingsRepository.findOne({
      where: { restaurantId },
    });
    const response = settings
      ? this.toResponse(settings)
      : this.defaultResponse(restaurantId);

    await this.cacheService.set(cacheKey, response, CacheTtl.publicRestaurant);
    return response;
  }

  async updatePause(
    restaurantId: string,
    ordersPaused: boolean,
  ): Promise<OrderSettingsResponseDto> {
    const settings = await this.findOrCreate(restaurantId);
    settings.ordersPaused = ordersPaused;
    const saved = await this.settingsRepository.save(settings);
    await this.invalidateCache(restaurantId);
    await this.nextRevalidationService.revalidateRestaurantPublicPage(
      restaurantId,
    );
    return this.toResponse(saved);
  }

  async update(
    restaurantId: string,
    dto: UpdateOrderSettingsDto,
  ): Promise<OrderSettingsResponseDto> {
    const settings = await this.findOrCreate(restaurantId);

    if (dto.fulfillmentDelivery !== undefined) {
      settings.fulfillmentDelivery = dto.fulfillmentDelivery;
    }
    if (dto.fulfillmentTakeaway !== undefined) {
      settings.fulfillmentTakeaway = dto.fulfillmentTakeaway;
    }
    if (dto.fulfillmentDineIn !== undefined) {
      settings.fulfillmentDineIn = dto.fulfillmentDineIn;
    }
    if (dto.paymentCash !== undefined) {
      settings.paymentCash = dto.paymentCash;
    }
    if (dto.paymentCardOnSite !== undefined) {
      settings.paymentCardOnSite = dto.paymentCardOnSite;
    }
    if (dto.paymentOnline !== undefined) {
      settings.paymentOnline = dto.paymentOnline;
    }
    if (dto.deliveryForSomeoneElse !== undefined) {
      settings.deliveryForSomeoneElse = dto.deliveryForSomeoneElse;
    }

    this.assertHasFulfillmentOption(settings);
    this.assertHasPaymentOption(settings);

    const saved = await this.settingsRepository.save(settings);
    await this.invalidateCache(restaurantId);
    await this.nextRevalidationService.revalidateRestaurantPublicPage(
      restaurantId,
    );
    return this.toResponse(saved);
  }

  private async findOrCreate(
    restaurantId: string,
  ): Promise<RestaurantOrderSettings> {
    const existing = await this.settingsRepository.findOne({
      where: { restaurantId },
    });
    if (existing) {
      return existing;
    }

    const created = this.settingsRepository.create({ restaurantId });
    return this.settingsRepository.save(created);
  }

  private async invalidateCache(restaurantId: string): Promise<void> {
    await this.cacheService.del(CacheKeys.orderSettings(restaurantId));
  }

  private defaultResponse(restaurantId: string): OrderSettingsResponseDto {
    return {
      restaurantId,
      fulfillmentDelivery: false,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: false,
      deliveryForSomeoneElse: false,
      ordersPaused: false,
      updatedAt: new Date(0),
    };
  }

  private assertHasFulfillmentOption(settings: RestaurantOrderSettings): void {
    if (
      !settings.fulfillmentDelivery &&
      !settings.fulfillmentTakeaway &&
      !settings.fulfillmentDineIn
    ) {
      throw new BadRequestException(
        'Выберите хотя бы один способ получения заказа',
      );
    }
  }

  private assertHasPaymentOption(settings: RestaurantOrderSettings): void {
    if (
      !settings.paymentCash &&
      !settings.paymentCardOnSite &&
      !settings.paymentOnline
    ) {
      throw new BadRequestException('Выберите хотя бы один способ оплаты');
    }
  }

  private toResponse(
    settings: RestaurantOrderSettings,
  ): OrderSettingsResponseDto {
    return {
      restaurantId: settings.restaurantId,
      fulfillmentDelivery: settings.fulfillmentDelivery,
      fulfillmentTakeaway: settings.fulfillmentTakeaway,
      fulfillmentDineIn: settings.fulfillmentDineIn,
      paymentCash: settings.paymentCash,
      paymentCardOnSite: settings.paymentCardOnSite,
      paymentOnline: settings.paymentOnline,
      deliveryForSomeoneElse: settings.deliveryForSomeoneElse,
      ordersPaused: settings.ordersPaused,
      updatedAt: settings.updatedAt,
    };
  }
}
