import { SocialLinksService } from './social-links.service';

describe('SocialLinksService cache', () => {
  const linkRepository = {
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

  const service = new SocialLinksService(
    linkRepository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.get.mockResolvedValue(null);
    linkRepository.find.mockResolvedValue([]);
  });

  it('caches public social links', async () => {
    await service.getByRestaurant(restaurantId);
    expect(cacheService.set).toHaveBeenCalledWith(
      `restaurant:${restaurantId}:social-links`,
      [],
      3600,
    );
  });

  it('invalidates cache after create', async () => {
    linkRepository.create.mockReturnValue({ url: 'https://t.me/cafe' });
    linkRepository.save.mockResolvedValue({
      id: 'link-1',
      restaurantId,
      url: 'https://t.me/cafe',
      label: null,
      platform: 'telegram',
      sortOrder: 0,
      createdAt: new Date(),
    });

    await service.create(restaurantId, { url: 'https://t.me/cafe' });

    expect(cacheService.del).toHaveBeenCalledWith(
      `restaurant:${restaurantId}:social-links`,
    );
  });
});
