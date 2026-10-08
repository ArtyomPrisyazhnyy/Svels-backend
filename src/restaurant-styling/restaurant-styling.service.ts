import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  async getByRestaurant(restaurantId: string): Promise<RestaurantStylingResponseDto> {
    const styling = await this.findOrCreate(restaurantId);
    return this.toResponse(styling);
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
    await this.nextRevalidationService.revalidateRestaurantPublicPage(restaurantId);
    return this.toResponse(saved);
  }

  private async findOrCreate(restaurantId: string): Promise<RestaurantStyling> {
    const existing = await this.stylingRepository.findOne({ where: { restaurantId } });
    if (existing) {
      return existing;
    }

    const created = this.stylingRepository.create({ restaurantId });
    return this.stylingRepository.save(created);
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
