import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { LoyaltyRewardType } from '../common/enums/loyalty.enum';
import { sanitizeText } from '../common/utils/sanitize.util';
import { generateUuidV7, isUuidV7 } from '../common/utils/uuid.util';
import { NextRevalidationService } from '../next-revalidation/next-revalidation.service';
import {
  FlameLevelDto,
  LoyaltyRewardDto,
  LoyaltySettingsResponseDto,
  UpdateLoyaltySettingsDto,
} from './dto/loyalty-settings.dto';
import { RestaurantLoyaltySettings } from './entities/restaurant-loyalty-settings.entity';
import type {
  FlameLevelConfig,
  LoyaltyRewardConfig,
} from './loyalty-settings.types';

@Injectable()
export class LoyaltySettingsService {
  constructor(
    @InjectRepository(RestaurantLoyaltySettings)
    private readonly settingsRepository: Repository<RestaurantLoyaltySettings>,
    private readonly cacheService: CacheService,
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  async getByRestaurant(restaurantId: string): Promise<LoyaltySettingsResponseDto> {
    const cacheKey = CacheKeys.loyaltySettings(restaurantId);
    const cached = await this.cacheService.get<LoyaltySettingsResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const settings = await this.findOrCreate(restaurantId);
    const response = this.toResponse(settings);
    await this.cacheService.set(cacheKey, response);
    return response;
  }

  async update(
    restaurantId: string,
    dto: UpdateLoyaltySettingsDto,
  ): Promise<LoyaltySettingsResponseDto> {
    const settings = await this.findOrCreate(restaurantId);

    if (dto.flameDisplayEnabled !== undefined) {
      settings.flameDisplayEnabled = dto.flameDisplayEnabled;
    }

    if (dto.flameRewardsEnabled !== undefined) {
      settings.flameRewardsEnabled = dto.flameRewardsEnabled;
    }

    if (dto.flameExpireDays !== undefined) {
      settings.flameExpireDays = dto.flameExpireDays;
    }

    if (dto.flameLevels !== undefined) {
      settings.flameLevels = this.normalizeLevels(dto.flameLevels);
    }

    if (!settings.flameDisplayEnabled) {
      settings.flameRewardsEnabled = false;
    }

    if (settings.flameRewardsEnabled && settings.flameLevels.length === 0) {
      throw new BadRequestException(
        'Добавьте хотя бы один уровень огонька или выключите программы лояльности',
      );
    }

    const saved = await this.settingsRepository.save(settings);
    await this.cacheService.del(CacheKeys.loyaltySettings(restaurantId));
    await this.nextRevalidationService.revalidateRestaurantPublicPage(restaurantId);
    return this.toResponse(saved);
  }

  private async findOrCreate(restaurantId: string): Promise<RestaurantLoyaltySettings> {
    const existing = await this.settingsRepository.findOne({ where: { restaurantId } });
    if (existing) {
      return existing;
    }

    const created = this.settingsRepository.create({
      restaurantId,
      flameDisplayEnabled: false,
      flameRewardsEnabled: false,
      flameExpireDays: 14,
      flameLevels: [],
      otherPrograms: [],
    });
    return this.settingsRepository.save(created);
  }

  private normalizeLevels(levels: FlameLevelDto[]): FlameLevelConfig[] {
    if (levels.length === 0) {
      return [];
    }

    const normalized = levels.map((level) => this.normalizeLevel(level));
    normalized.sort((a, b) => a.requiredVisits - b.requiredVisits);

    const visits = new Set<number>();
    for (const level of normalized) {
      if (visits.has(level.requiredVisits)) {
        throw new BadRequestException(
          `Порог «${level.requiredVisits}» визитов указан у двух уровней`,
        );
      }
      visits.add(level.requiredVisits);
    }

    return normalized;
  }

  private normalizeLevel(level: FlameLevelDto): FlameLevelConfig {
    const name = sanitizeText(level.name.trim());
    if (!name) {
      throw new BadRequestException('Укажите название уровня');
    }

    return {
      id: level.id && isUuidV7(level.id) ? level.id : generateUuidV7(),
      name,
      requiredVisits: level.requiredVisits,
      rewards: (level.rewards ?? []).map((reward) => this.normalizeReward(reward)),
    };
  }

  private normalizeReward(reward: LoyaltyRewardDto): LoyaltyRewardConfig {
    const title = sanitizeText(reward.title.trim());
    if (!title) {
      throw new BadRequestException('Укажите название награды');
    }

    const description =
      reward.description === null || reward.description === undefined
        ? null
        : sanitizeText(reward.description.trim()) || null;

    const base: LoyaltyRewardConfig = {
      id: reward.id && isUuidV7(reward.id) ? reward.id : generateUuidV7(),
      type: reward.type,
      title,
      description,
      percentOff: null,
      amountOff: null,
      menuItemId: null,
      minOrderAmount:
        reward.minOrderAmount === null || reward.minOrderAmount === undefined
          ? null
          : Number(reward.minOrderAmount),
    };

    switch (reward.type) {
      case LoyaltyRewardType.PERCENT_DISCOUNT: {
        if (reward.percentOff == null) {
          throw new BadRequestException('Укажите процент скидки');
        }
        return { ...base, percentOff: Number(reward.percentOff) };
      }
      case LoyaltyRewardType.FIXED_DISCOUNT: {
        if (reward.amountOff == null) {
          throw new BadRequestException('Укажите сумму скидки');
        }
        return { ...base, amountOff: Number(reward.amountOff) };
      }
      case LoyaltyRewardType.FREE_MENU_ITEM: {
        if (!reward.menuItemId || !isUuidV7(reward.menuItemId)) {
          throw new BadRequestException('Выберите позицию меню для подарка');
        }
        return { ...base, menuItemId: reward.menuItemId };
      }
      case LoyaltyRewardType.CUSTOM:
        return base;
      default:
        throw new BadRequestException('Неизвестный тип награды');
    }
  }

  private toResponse(settings: RestaurantLoyaltySettings): LoyaltySettingsResponseDto {
    return {
      restaurantId: settings.restaurantId,
      flameDisplayEnabled: settings.flameDisplayEnabled,
      flameRewardsEnabled: settings.flameRewardsEnabled,
      flameExpireDays: settings.flameExpireDays,
      flameLevels: settings.flameLevels ?? [],
      otherPrograms: settings.otherPrograms ?? [],
      updatedAt: settings.updatedAt,
    };
  }
}
