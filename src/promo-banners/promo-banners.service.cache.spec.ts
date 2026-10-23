import { PromoBannerType } from '../common/enums/promo-banner.enum';
import { PromoBannersService } from './promo-banners.service';

describe('PromoBannersService cache invalidation', () => {
  const bannerRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new PromoBannersService(
    bannerRepository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.get.mockResolvedValue(null);
    bannerRepository.find.mockResolvedValue([]);
  });

  it('invalidates cache after banner create', async () => {
    bannerRepository.create.mockReturnValue({});
    bannerRepository.save.mockResolvedValue({
      id: 'b1',
      restaurantId,
      title: 'Promo',
      isActive: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.create(restaurantId, {
      type: PromoBannerType.MODAL,
      title: 'Promo',
      imageUrl: 'https://cdn.test/p.jpg',
    });

    expect(cacheService.del).toHaveBeenCalledWith(
      `restaurant:${restaurantId}:promo-banners`,
    );
  });
});
