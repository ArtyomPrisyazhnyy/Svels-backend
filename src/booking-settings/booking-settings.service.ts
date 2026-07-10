import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingMode } from '../common/enums/booking-mode.enum';
import { DepositScheme } from '../common/enums/deposit-scheme.enum';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { NextRevalidationService } from '../next-revalidation/next-revalidation.service';
import {
  BookingSettingsResponseDto,
  SetDepositDto,
  UpdateBookingSettingsDto,
} from './dto/booking-settings.dto';
import { RestaurantBookingSettings } from './entities/restaurant-booking-settings.entity';

/** Примитивный срез настроек для межмодульного использования (без Date — кэш-безопасен). */
export interface BookingSettingsSnapshot {
  restaurantId: string;
  bookingEnabled: boolean;
  mode: BookingMode;
  depositScheme: DepositScheme;
  depositAmount: number;
  bookingDurationMinutes: number;
  slotMinutes: number;
  maxGuests: number;
  advanceDays: number;
  autoConfirm: boolean;
}

@Injectable()
export class BookingSettingsService {
  constructor(
    @InjectRepository(RestaurantBookingSettings)
    private readonly settingsRepository: Repository<RestaurantBookingSettings>,
    private readonly cacheService: CacheService,
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  async getByRestaurant(restaurantId: string): Promise<BookingSettingsResponseDto> {
    const settings = await this.findOrCreate(restaurantId);
    return this.toResponse(settings);
  }

  async update(
    restaurantId: string,
    dto: UpdateBookingSettingsDto,
  ): Promise<BookingSettingsResponseDto> {
    const settings = await this.findOrCreate(restaurantId);

    if (dto.bookingEnabled !== undefined) {
      settings.bookingEnabled = dto.bookingEnabled;
    }
    if (dto.mode !== undefined) {
      settings.mode = dto.mode;
    }
    if (dto.depositScheme !== undefined) {
      settings.depositScheme = dto.depositScheme;
    }
    if (dto.depositAmount !== undefined) {
      settings.depositAmount = dto.depositAmount;
    }
    if (dto.bookingDurationMinutes !== undefined) {
      settings.bookingDurationMinutes = dto.bookingDurationMinutes;
    }
    if (dto.slotMinutes !== undefined) {
      settings.slotMinutes = dto.slotMinutes;
    }
    if (dto.maxGuests !== undefined) {
      settings.maxGuests = dto.maxGuests;
    }
    if (dto.advanceDays !== undefined) {
      settings.advanceDays = dto.advanceDays;
    }
    if (dto.autoConfirm !== undefined) {
      settings.autoConfirm = dto.autoConfirm;
    }

    const saved = await this.settingsRepository.save(settings);
    await this.invalidateCache(restaurantId);
    await this.nextRevalidationService.revalidateRestaurantPublicPage(restaurantId);
    return this.toResponse(saved);
  }

  /** Тонкий эндпоинт для панели депозитов конструктора планировки. */
  async setDeposit(
    restaurantId: string,
    dto: SetDepositDto,
  ): Promise<BookingSettingsResponseDto> {
    return this.update(restaurantId, {
      depositScheme: dto.scheme,
      depositAmount: dto.amount,
    });
  }

  /** Кэшированный срез настроек для других модулей (bookings/availability). */
  async getSnapshot(restaurantId: string): Promise<BookingSettingsSnapshot> {
    const cacheKey = CacheKeys.bookingSettings(restaurantId);
    const cached = await this.cacheService.get<BookingSettingsSnapshot>(cacheKey);
    if (cached) {
      return cached;
    }

    const settings = await this.findOrCreate(restaurantId);
    const snapshot = this.toSnapshot(settings);
    await this.cacheService.set(cacheKey, snapshot);
    return snapshot;
  }

  private async findOrCreate(
    restaurantId: string,
  ): Promise<RestaurantBookingSettings> {
    const existing = await this.settingsRepository.findOne({ where: { restaurantId } });
    if (existing) {
      return existing;
    }

    const created = this.settingsRepository.create({ restaurantId });
    return this.settingsRepository.save(created);
  }

  private async invalidateCache(restaurantId: string): Promise<void> {
    await this.cacheService.delMany([
      CacheKeys.bookingSettings(restaurantId),
      CacheKeys.floorPlan(restaurantId),
      CacheKeys.publicLayout(restaurantId),
    ]);
  }

  private toSnapshot(settings: RestaurantBookingSettings): BookingSettingsSnapshot {
    return {
      restaurantId: settings.restaurantId,
      bookingEnabled: settings.bookingEnabled,
      mode: settings.mode,
      depositScheme: settings.depositScheme,
      depositAmount: Number(settings.depositAmount),
      bookingDurationMinutes: settings.bookingDurationMinutes,
      slotMinutes: settings.slotMinutes,
      maxGuests: settings.maxGuests,
      advanceDays: settings.advanceDays,
      autoConfirm: settings.autoConfirm,
    };
  }

  private toResponse(
    settings: RestaurantBookingSettings,
  ): BookingSettingsResponseDto {
    return {
      ...this.toSnapshot(settings),
      updatedAt: settings.updatedAt,
    };
  }
}
