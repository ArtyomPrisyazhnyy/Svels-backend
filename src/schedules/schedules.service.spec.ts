import { SchedulesService } from './schedules.service';

describe('SchedulesService cache', () => {
  const scheduleRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new SchedulesService(
    scheduleRepository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached schedules on hit', async () => {
    cacheService.get.mockResolvedValue([{ id: 's1' }]);

    const result = await service.getByRestaurant(restaurantId);
    expect(result).toEqual([{ id: 's1' }]);
    expect(scheduleRepository.find).not.toHaveBeenCalled();
  });

  it('invalidates cache and revalidates after update', async () => {
    scheduleRepository.findOne.mockResolvedValue({
      id: 's1',
      restaurantId,
    });
    scheduleRepository.save.mockResolvedValue({ id: 's1' });

    await service.update(restaurantId, 's1', { isOpen: false });

    expect(cacheService.del).toHaveBeenCalledWith(
      `restaurant:${restaurantId}:schedules`,
    );
    expect(
      nextRevalidationService.revalidateRestaurantPublicPage,
    ).toHaveBeenCalledWith(restaurantId);
  });
});
