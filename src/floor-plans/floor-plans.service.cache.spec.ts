import { FloorPlansService } from './floor-plans.service';

describe('FloorPlansService cache invalidation', () => {
  const floorPlanRepository = {
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
  const tableRepository = { find: jest.fn() };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delMany: jest.fn(),
    delByPattern: jest.fn(),
  };
  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };
  const bookingSettingsService = {
    getSnapshot: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };

  const service = new FloorPlansService(
    floorPlanRepository as never,
    tableRepository as never,
    cacheService as never,
    nextRevalidationService as never,
    bookingSettingsService as never,
    dataSource as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  beforeEach(() => {
    jest.clearAllMocks();
    floorPlanRepository.find.mockResolvedValue([]);
    tableRepository.find.mockResolvedValue([]);
    cacheService.get.mockResolvedValue(null);
    bookingSettingsService.getSnapshot.mockResolvedValue({
      depositScheme: 'none',
      globalDepositAmount: 0,
      bookingDurationMinutes: 120,
    });
  });

  it('revalidates public page after layout load cache write path', async () => {
    await service.getPublicLayout(restaurantId);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('does not call delByPattern on invalidate (availability keys unused)', async () => {
    floorPlanRepository.save.mockResolvedValue({
      id: 'fp2',
      restaurantId,
      name: 'New',
      sortOrder: 1,
      depositAmount: 0,
      decorData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createFloorPlan(restaurantId, { name: 'New' });

    expect(cacheService.delByPattern).not.toHaveBeenCalled();
    expect(
      nextRevalidationService.revalidateRestaurantPublicPage,
    ).toHaveBeenCalledWith(restaurantId);
  });
});
