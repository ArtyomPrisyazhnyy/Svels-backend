import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import {
  PromoBannerAspectRatio,
  PromoBannerDisplayFrequency,
  PromoBannerType,
} from '../common/enums/promo-banner.enum';
import { sanitizeText } from '../common/utils/sanitize.util';
import { NextRevalidationService } from '../next-revalidation/next-revalidation.service';
import {
  CreatePromoBannerDto,
  PromoBannerResponseDto,
  UpdatePromoBannerDto,
} from './dto/promo-banner.dto';
import { PromoBanner } from './entities/promo-banner.entity';

@Injectable()
export class PromoBannersService {
  constructor(
    @InjectRepository(PromoBanner)
    private readonly bannerRepository: Repository<PromoBanner>,
    private readonly cacheService: CacheService,
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  async getByRestaurant(restaurantId: string): Promise<PromoBannerResponseDto[]> {
    const cacheKey = CacheKeys.promoBanners(restaurantId);
    const cached = await this.cacheService.get<PromoBannerResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const banners = await this.bannerRepository.find({
      where: { restaurantId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    const result = banners.map((banner) => this.toResponse(banner));
    await this.cacheService.set(cacheKey, result);
    return result;
  }

  /** Активные баннеры для публичной страницы (Cache-Aside через getByRestaurant). */
  async getActiveByRestaurant(restaurantId: string): Promise<PromoBannerResponseDto[]> {
    const all = await this.getByRestaurant(restaurantId);
    return all.filter((banner) => banner.isActive);
  }

  async create(
    restaurantId: string,
    dto: CreatePromoBannerDto,
  ): Promise<PromoBannerResponseDto> {
    const banner = this.bannerRepository.create({
      restaurantId,
      type: dto.type,
      title: this.normalizeOptionalText(dto.title),
      imageUrl: dto.imageUrl.trim(),
      imageWebpUrl: this.normalizeOptionalUrl(dto.imageWebpUrl),
      linkUrl: this.normalizeLinkUrl(dto.linkUrl),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      displayFrequency: this.resolveDisplayFrequency(dto.type, dto.displayFrequency),
      aspectRatio: this.resolveAspectRatio(dto.type, dto.aspectRatio),
    });

    const saved = await this.bannerRepository.save(banner);
    await this.afterMutation(restaurantId);
    return this.toResponse(saved);
  }

  async update(
    restaurantId: string,
    bannerId: string,
    dto: UpdatePromoBannerDto,
  ): Promise<PromoBannerResponseDto> {
    const banner = await this.findOwnedBanner(restaurantId, bannerId);

    if (dto.type !== undefined) {
      banner.type = dto.type;
    }

    if (dto.title !== undefined) {
      banner.title = this.normalizeOptionalText(dto.title);
    }

    if (dto.imageUrl !== undefined) {
      banner.imageUrl = dto.imageUrl.trim();
    }

    if (dto.imageWebpUrl !== undefined) {
      banner.imageWebpUrl = this.normalizeOptionalUrl(dto.imageWebpUrl);
    }

    if (dto.linkUrl !== undefined) {
      banner.linkUrl = this.normalizeLinkUrl(dto.linkUrl);
    }

    if (dto.isActive !== undefined) {
      banner.isActive = dto.isActive;
    }

    if (dto.sortOrder !== undefined) {
      banner.sortOrder = dto.sortOrder;
    }

    const nextType = dto.type ?? banner.type;
    if (dto.displayFrequency !== undefined || dto.type !== undefined) {
      banner.displayFrequency = this.resolveDisplayFrequency(
        nextType,
        dto.displayFrequency ?? banner.displayFrequency,
      );
    }

    if (dto.aspectRatio !== undefined || dto.type !== undefined) {
      banner.aspectRatio = this.resolveAspectRatio(
        nextType,
        dto.aspectRatio ?? banner.aspectRatio,
      );
    }

    const saved = await this.bannerRepository.save(banner);
    await this.afterMutation(restaurantId);
    return this.toResponse(saved);
  }

  async remove(restaurantId: string, bannerId: string): Promise<void> {
    const banner = await this.findOwnedBanner(restaurantId, bannerId);
    await this.bannerRepository.remove(banner);
    await this.afterMutation(restaurantId);
  }

  private async findOwnedBanner(
    restaurantId: string,
    bannerId: string,
  ): Promise<PromoBanner> {
    const banner = await this.bannerRepository.findOne({
      where: { id: bannerId, restaurantId },
    });

    if (!banner) {
      throw new NotFoundException('Баннер не найден');
    }

    return banner;
  }

  private async afterMutation(restaurantId: string): Promise<void> {
    await this.invalidateCache(restaurantId);
    await this.nextRevalidationService.revalidateRestaurantPublicPage(restaurantId);
  }

  private async invalidateCache(restaurantId: string): Promise<void> {
    await this.cacheService.del(CacheKeys.promoBanners(restaurantId));
  }

  private resolveDisplayFrequency(
    type: PromoBannerType,
    frequency?: PromoBannerDisplayFrequency,
  ): PromoBannerDisplayFrequency {
    if (type === PromoBannerType.STRIP) {
      return PromoBannerDisplayFrequency.EVERY_VISIT;
    }

    return frequency ?? PromoBannerDisplayFrequency.EVERY_VISIT;
  }

  private resolveAspectRatio(
    type: PromoBannerType,
    aspectRatio?: PromoBannerAspectRatio,
  ): PromoBannerAspectRatio {
    if (type === PromoBannerType.MODAL) {
      return PromoBannerAspectRatio.RATIO_4_1;
    }

    return aspectRatio ?? PromoBannerAspectRatio.RATIO_4_1;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? sanitizeText(trimmed) : null;
  }

  private normalizeOptionalUrl(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private normalizeLinkUrl(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new BadRequestException('Ссылка баннера должна начинаться с http:// или https://');
      }
      return url.toString();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Некорректная ссылка баннера');
    }
  }

  private toResponse(banner: PromoBanner): PromoBannerResponseDto {
    return {
      id: banner.id,
      restaurantId: banner.restaurantId,
      type: banner.type,
      title: banner.title,
      imageUrl: banner.imageUrl,
      imageWebpUrl: banner.imageWebpUrl,
      linkUrl: banner.linkUrl,
      isActive: banner.isActive,
      sortOrder: banner.sortOrder,
      displayFrequency: banner.displayFrequency,
      aspectRatio: banner.aspectRatio ?? PromoBannerAspectRatio.RATIO_4_1,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    };
  }
}
