import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys, CacheTtl } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import {
  MagazineCardLayout,
  RestaurantButtonShape,
  RestaurantButtonVariant,
  RestaurantCardStyle,
  RestaurantColorTheme,
  RestaurantCurrencyDisplay,
  RestaurantFontFamily,
  RestaurantFooterAccent,
  RestaurantFooterLayout,
  RestaurantHeaderStyle,
  RestaurantSwitcherStyle,
} from '../common/enums/restaurant-styling.enum';
import { NextRevalidationService } from '../next-revalidation/next-revalidation.service';
import {
  RestaurantStylingResponseDto,
  UpdateRestaurantStylingDto,
} from './dto/restaurant-styling.dto';
import { RestaurantStyling } from './entities/restaurant-styling.entity';

@Injectable()
export class RestaurantStylingService {
  constructor(
    @InjectRepository(RestaurantStyling)
    private readonly stylingRepository: Repository<RestaurantStyling>,
    private readonly cacheService: CacheService,
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  /** Публичное чтение: без записи в БД, с кэшем. */
  async getPublicByRestaurant(
    restaurantId: string,
  ): Promise<RestaurantStylingResponseDto> {
    const cacheKey = CacheKeys.styling(restaurantId);
    const cached =
      await this.cacheService.get<RestaurantStylingResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const styling = await this.stylingRepository.findOne({
      where: { restaurantId },
    });
    const response = styling
      ? this.toResponse(styling)
      : this.defaultResponse(restaurantId);

    await this.cacheService.set(cacheKey, response, CacheTtl.publicRestaurant);
    return response;
  }

  async update(
    restaurantId: string,
    dto: UpdateRestaurantStylingDto,
  ): Promise<RestaurantStylingResponseDto> {
    const styling = await this.findOrCreate(restaurantId);

    if (dto.fontFamily !== undefined) {
      styling.fontFamily = dto.fontFamily;
    }
    if (dto.colorTheme !== undefined) {
      styling.colorTheme = dto.colorTheme;
    }
    if (dto.currencyDisplay !== undefined) {
      styling.currencyDisplay = dto.currencyDisplay;
    }
    if (dto.buttonShape !== undefined) {
      styling.buttonShape = dto.buttonShape;
    }
    if (dto.buttonVariant !== undefined) {
      styling.buttonVariant = dto.buttonVariant;
    }
    if (dto.switcherStyle !== undefined) {
      styling.switcherStyle = dto.switcherStyle;
    }
    if (dto.cardStyle !== undefined) {
      styling.cardStyle = dto.cardStyle;
    }
    if (dto.magazineCardLayout !== undefined) {
      styling.magazineCardLayout = dto.magazineCardLayout;
    }
    if (dto.menuCategoryNavEnabled !== undefined) {
      styling.menuCategoryNavEnabled = dto.menuCategoryNavEnabled;
    }
    if (dto.favoritesEnabled !== undefined) {
      styling.favoritesEnabled = dto.favoritesEnabled;
    }
    if (dto.headerStyle !== undefined) {
      styling.headerStyle = dto.headerStyle;
    }
    if (dto.footerLayout !== undefined) {
      styling.footerLayout = dto.footerLayout;
    }
    if (dto.footerAccent !== undefined) {
      styling.footerAccent = dto.footerAccent;
    }

    const saved = await this.stylingRepository.save(styling);
    await this.cacheService.del(CacheKeys.styling(restaurantId));
    await this.nextRevalidationService.revalidateRestaurantPublicPage(
      restaurantId,
    );
    return this.toResponse(saved);
  }

  private async findOrCreate(restaurantId: string): Promise<RestaurantStyling> {
    const existing = await this.stylingRepository.findOne({
      where: { restaurantId },
    });
    if (existing) {
      return existing;
    }

    const created = this.stylingRepository.create({ restaurantId });
    return this.stylingRepository.save(created);
  }

  private defaultResponse(restaurantId: string): RestaurantStylingResponseDto {
    return {
      restaurantId,
      fontFamily: RestaurantFontFamily.SYSTEM,
      colorTheme: RestaurantColorTheme.CLASSIC,
      currencyDisplay: RestaurantCurrencyDisplay.BYN_GLYPH,
      buttonShape: RestaurantButtonShape.ROUNDED,
      buttonVariant: RestaurantButtonVariant.FILLED,
      switcherStyle: RestaurantSwitcherStyle.PILL,
      cardStyle: RestaurantCardStyle.CLASSIC,
      magazineCardLayout: MagazineCardLayout.CONTENT_LEFT,
      menuCategoryNavEnabled: false,
      favoritesEnabled: true,
      headerStyle: RestaurantHeaderStyle.GLASS,
      footerLayout: RestaurantFooterLayout.COLUMNS,
      footerAccent: RestaurantFooterAccent.FLAT,
      updatedAt: new Date(0),
    };
  }

  private toResponse(styling: RestaurantStyling): RestaurantStylingResponseDto {
    return {
      restaurantId: styling.restaurantId,
      fontFamily: styling.fontFamily,
      colorTheme: styling.colorTheme,
      currencyDisplay: styling.currencyDisplay,
      buttonShape: styling.buttonShape,
      buttonVariant: styling.buttonVariant,
      switcherStyle: styling.switcherStyle,
      cardStyle: styling.cardStyle,
      magazineCardLayout: styling.magazineCardLayout,
      menuCategoryNavEnabled: styling.menuCategoryNavEnabled,
      favoritesEnabled: styling.favoritesEnabled,
      headerStyle: styling.headerStyle,
      footerLayout: styling.footerLayout,
      footerAccent: styling.footerAccent,
      updatedAt: styling.updatedAt,
    };
  }
}
