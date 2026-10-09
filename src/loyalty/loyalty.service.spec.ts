import { DataSource } from 'typeorm';

import { LoyaltySettingsService } from '../loyalty-settings/loyalty-settings.service';
import { GuestLoyaltyBalance } from './entities/guest-loyalty-balance.entity';
import { LoyaltyService } from './loyalty.service';

jest.mock('../common/utils/uuid.util', () => ({
  generateUuidV7: () => '0190c0de-0000-7000-8000-0000000000dd',
}));

const DAY_MS = 86_400_000;
const NOW = new Date('2026-10-01T12:00:00.000Z');
const RESTAURANT_ID = '0190c0de-0000-7000-8000-0000000000ff';
const USER_ID = '0190c0de-0000-7000-8000-0000000000aa';
const ORDER_ID = '0190c0de-0000-7000-8000-0000000000bb';

describe('LoyaltyService', () => {
  let insertResult: { raw: unknown[] };
  let queryBuilder: Record<string, jest.Mock>;
  let manager: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
    getRepository: jest.Mock;
  };
  let settingsService: { getByRestaurant: jest.Mock };
  let service: LoyaltyService;

  beforeEach(() => {
    insertResult = { raw: [{ id: '0190c0de-0000-7000-8000-0000000000cc' }] };
    queryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn(() => Promise.resolve(insertResult)),
    };
    manager = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((entity: GuestLoyaltyBalance) => Promise.resolve(entity)),
    };
    dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
      getRepository: jest.fn(() => ({ findOne: jest.fn() })),
    };
    settingsService = { getByRestaurant: jest.fn() };

    service = new LoyaltyService(
      dataSource as unknown as DataSource,
      settingsService as unknown as LoyaltySettingsService,
    );
  });

  const recordParams = (expireDays = 14) => ({
    restaurantId: RESTAURANT_ID,
    userId: USER_ID,
    orderId: ORDER_ID,
    expireDays,
    now: NOW,
  });

  it('starts the series on the first visit', async () => {
    const recorded = await service.recordVisit(recordParams());

    expect(recorded).toBe(true);
    expect(queryBuilder.orIgnore).toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        userId: USER_ID,
        visits: 1,
        totalVisits: 1,
        lastVisitAt: NOW,
      }),
    );
  });

  it('ignores a repeated visit for the same order', async () => {
    insertResult = { raw: [] };

    const recorded = await service.recordVisit(recordParams());

    expect(recorded).toBe(false);
    expect(manager.findOne).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('increments the series within the expiry window', async () => {
    manager.findOne.mockResolvedValue(
      Object.assign(new GuestLoyaltyBalance(), {
        restaurantId: RESTAURANT_ID,
        userId: USER_ID,
        visits: 2,
        totalVisits: 4,
        lastVisitAt: new Date(NOW.getTime() - 3 * DAY_MS),
      }),
    );

    await service.recordVisit(recordParams());

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ visits: 3, totalVisits: 5, lastVisitAt: NOW }),
    );
  });

  it('restarts the series after expireDays without visits and keeps totalVisits growing', async () => {
    manager.findOne.mockResolvedValue(
      Object.assign(new GuestLoyaltyBalance(), {
        restaurantId: RESTAURANT_ID,
        userId: USER_ID,
        visits: 3,
        totalVisits: 5,
        lastVisitAt: new Date(NOW.getTime() - 15 * DAY_MS),
      }),
    );

    await service.recordVisit(recordParams(14));

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ visits: 1, totalVisits: 6, lastVisitAt: NOW }),
    );
  });

  it('returns the balance with the guest id for the given restaurant', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    dataSource.getRepository.mockReturnValue({ findOne });
    settingsService.getByRestaurant.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      flameDisplayEnabled: true,
      flameRewardsEnabled: false,
      flameExpireDays: 14,
      flameLevels: [],
    });

    const result = await service.getBalance(RESTAURANT_ID, USER_ID, NOW);

    expect(settingsService.getByRestaurant).toHaveBeenCalledWith(RESTAURANT_ID);
    expect(findOne).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT_ID, userId: USER_ID },
    });
    expect(result).toEqual(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        userId: USER_ID,
        enabled: true,
        visits: 0,
        totalVisits: 0,
        lastVisitAt: null,
      }),
    );
  });
});
