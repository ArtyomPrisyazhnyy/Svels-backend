import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sanitizeText } from '../common/utils/sanitize.util';
import { NextRevalidationService } from '../next-revalidation/next-revalidation.service';
import {
  CreateSocialLinkDto,
  SocialLinkResponseDto,
  UpdateSocialLinkDto,
} from './dto/social-link.dto';
import { RestaurantSocialLink } from './entities/restaurant-social-link.entity';
import {
  detectSocialPlatform,
  normalizeSocialUrl,
} from './utils/social-link.util';

@Injectable()
export class SocialLinksService {
  constructor(
    @InjectRepository(RestaurantSocialLink)
    private readonly linkRepository: Repository<RestaurantSocialLink>,
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  async getByRestaurant(
    restaurantId: string,
  ): Promise<SocialLinkResponseDto[]> {
    const links = await this.linkRepository.find({
      where: { restaurantId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return links.map((link) => this.toResponse(link));
  }

  async create(
    restaurantId: string,
    dto: CreateSocialLinkDto,
  ): Promise<SocialLinkResponseDto> {
    const url = normalizeSocialUrl(dto.url);
    const link = this.linkRepository.create({
      restaurantId,
      url,
      label: this.normalizeLabel(dto.label),
      platform: detectSocialPlatform(url),
      sortOrder: dto.sortOrder ?? 0,
    });

    const saved = await this.linkRepository.save(link);
    await this.nextRevalidationService.revalidateRestaurantPublicPage(
      restaurantId,
    );
    return this.toResponse(saved);
  }

  async update(
    restaurantId: string,
    linkId: string,
    dto: UpdateSocialLinkDto,
  ): Promise<SocialLinkResponseDto> {
    const link = await this.findOwnedLink(restaurantId, linkId);

    if (dto.url !== undefined) {
      const url = normalizeSocialUrl(dto.url);
      link.url = url;
      link.platform = detectSocialPlatform(url);
    }

    if (dto.label !== undefined) {
      link.label = this.normalizeLabel(dto.label);
    }

    if (dto.sortOrder !== undefined) {
      link.sortOrder = dto.sortOrder;
    }

    const saved = await this.linkRepository.save(link);
    await this.nextRevalidationService.revalidateRestaurantPublicPage(
      restaurantId,
    );
    return this.toResponse(saved);
  }

  async remove(restaurantId: string, linkId: string): Promise<void> {
    const link = await this.findOwnedLink(restaurantId, linkId);
    await this.linkRepository.remove(link);
    await this.nextRevalidationService.revalidateRestaurantPublicPage(
      restaurantId,
    );
  }

  private async findOwnedLink(
    restaurantId: string,
    linkId: string,
  ): Promise<RestaurantSocialLink> {
    const link = await this.linkRepository.findOne({
      where: { id: linkId, restaurantId },
    });

    if (!link) {
      throw new NotFoundException('Ссылка не найдена');
    }

    return link;
  }

  private toResponse(link: RestaurantSocialLink): SocialLinkResponseDto {
    return {
      id: link.id,
      restaurantId: link.restaurantId,
      url: link.url,
      label: link.label,
      platform: link.platform,
      sortOrder: link.sortOrder,
      createdAt: link.createdAt,
    };
  }

  private normalizeLabel(label?: string | null): string | null {
    if (label === null) {
      return null;
    }

    const trimmed = label?.trim();
    return trimmed ? sanitizeText(trimmed) : null;
  }
}
