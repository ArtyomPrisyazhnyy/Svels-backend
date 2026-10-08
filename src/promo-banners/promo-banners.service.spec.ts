import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PromoBannerAspectRatio,
  PromoBannerDisplayFrequency,
  PromoBannerType,
} from '../common/enums/promo-banner.enum';
import { PromoBanner } from './entities/promo-banner.entity';
import { PromoBannersService } from './promo-banners.service';

describe('PromoBannersService', () => {
  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';
  const bannerId = '019efb61-5d8e-7058-b838-6f2696cb4205';

  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new PromoBannersService(
    repository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.get.mockResolvedValue(null);
  });

  it('forces every_visit frequency for strip banners', async () => {
    const created = {
      id: bannerId,
      restaurantId,
      type: PromoBannerType.STRIP,
      title: null,
      imageUrl: 'https://cdn.example/banner.jpg',
      imageWebpUrl: null,
      linkUrl: null,
      isActive: true,
      sortOrder: 0,
      displayFrequency: PromoBannerDisplayFrequency.EVERY_VISIT,
      aspectRatio: PromoBannerAspectRatio.RATIO_16_9,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PromoBanner;

    repository.create.mockImplementation((value: PromoBanner) => value);
    repository.save.mockResolvedValue(created);

    await service.create(restaurantId, {
      type: PromoBannerType.STRIP,
      imageUrl: 'https://cdn.example/banner.jpg',
      displayFrequency: PromoBannerDisplayFrequency.ONCE,
      aspectRatio: PromoBannerAspectRatio.RATIO_16_9,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PromoBannerType.STRIP,
        displayFrequency: PromoBannerDisplayFrequency.EVERY_VISIT,
        aspectRatio: PromoBannerAspectRatio.RATIO_16_9,
      }),
    );
    expect(cacheService.del).toHaveBeenCalled();
    expect(nextRevalidationService.revalidateRestaurantPublicPage).toHaveBeenCalledWith(
      restaurantId,
    );
  });

  it('rejects invalid banner link URL', async () => {
    await expect(
      service.create(restaurantId, {
        type: PromoBannerType.MODAL,
        imageUrl: 'https://cdn.example/banner.jpg',
        linkUrl: 'not-a-url',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when updating missing banner', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.update(restaurantId, bannerId, { isActive: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters inactive banners for public active list', async () => {
    repository.find.mockResolvedValue([
      {
        id: bannerId,
        restaurantId,
        type: PromoBannerType.MODAL,
        title: 'Sale',
        imageUrl: 'https://cdn.example/a.jpg',
        imageWebpUrl: null,
        linkUrl: null,
        isActive: true,
        sortOrder: 0,
        displayFrequency: PromoBannerDisplayFrequency.ONCE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '019efb61-5d8e-7058-b838-6f2696cb4206',
        restaurantId,
        type: PromoBannerType.STRIP,
        title: null,
        imageUrl: 'https://cdn.example/b.jpg',
        imageWebpUrl: null,
        linkUrl: null,
        isActive: false,
        sortOrder: 1,
        displayFrequency: PromoBannerDisplayFrequency.EVERY_VISIT,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as PromoBanner[]);

    const active = await service.getActiveByRestaurant(restaurantId);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(bannerId);
  });
});
