import { LoyaltyRewardType } from '../common/enums/loyalty.enum';
import type { FlameLevelConfig } from '../loyalty-settings/loyalty-settings.types';
import {
  buildLoyaltyBalance,
  LoyaltyBalanceSettings,
} from './loyalty-balance.util';
import { GuestLoyaltyBalance } from './entities/guest-loyalty-balance.entity';

const DAY_MS = 86_400_000;
const NOW = new Date('2026-10-01T12:00:00.000Z');

const reward = {
  id: '0190c0de-0000-7000-8000-000000000001',
  type: LoyaltyRewardType.CUSTOM,
  title: 'Кофе',
  description: null,
  percentOff: null,
  amountOff: null,
  menuItemId: null,
  minOrderAmount: null,
};

const levels: FlameLevelConfig[] = [
  {
    id: '0190c0de-0000-7000-8000-00000000000a',
    name: 'Бронза',
    requiredVisits: 2,
    rewards: [reward],
  },
  {
    id: '0190c0de-0000-7000-8000-00000000000b',
    name: 'Золото',
    requiredVisits: 5,
    rewards: [],
  },
];

function settings(
  overrides: Partial<LoyaltyBalanceSettings> = {},
): LoyaltyBalanceSettings {
  return {
    restaurantId: '0190c0de-0000-7000-8000-0000000000ff',
    flameDisplayEnabled: true,
    flameRewardsEnabled: true,
    flameExpireDays: 14,
    flameLevels: levels,
    ...overrides,
  };
}

function balance(
  overrides: Partial<GuestLoyaltyBalance> = {},
): GuestLoyaltyBalance {
  return Object.assign(new GuestLoyaltyBalance(), {
    restaurantId: '0190c0de-0000-7000-8000-0000000000ff',
    userId: '0190c0de-0000-7000-8000-0000000000aa',
    visits: 3,
    totalVisits: 3,
    lastVisitAt: new Date(NOW.getTime() - DAY_MS),
    updatedAt: NOW,
    ...overrides,
  });
}

describe('buildLoyaltyBalance', () => {
  it('returns zeros when there is no balance record', () => {
    const result = buildLoyaltyBalance(settings(), null, NOW);

    expect(result).toEqual({
      restaurantId: '0190c0de-0000-7000-8000-0000000000ff',
      enabled: true,
      rewardsEnabled: true,
      visits: 0,
      totalVisits: 0,
      lastVisitAt: null,
      expiresAt: null,
      currentLevel: null,
      nextLevel: {
        id: levels[0].id,
        name: 'Бронза',
        requiredVisits: 2,
        visitsLeft: 2,
      },
      availableRewards: [],
    });
  });

  it('resolves current and next levels for 3 visits with levels [2, 5]', () => {
    const result = buildLoyaltyBalance(settings(), balance({ visits: 3 }), NOW);

    expect(result.visits).toBe(3);
    expect(result.currentLevel).toEqual({
      id: levels[0].id,
      name: 'Бронза',
      requiredVisits: 2,
    });
    expect(result.nextLevel).toEqual({
      id: levels[1].id,
      name: 'Золото',
      requiredVisits: 5,
      visitsLeft: 2,
    });
    expect(result.availableRewards).toEqual([reward]);
  });

  it('expires the series when the last visit is older than flameExpireDays', () => {
    const result = buildLoyaltyBalance(
      settings(),
      balance({
        visits: 4,
        totalVisits: 7,
        lastVisitAt: new Date(NOW.getTime() - 15 * DAY_MS),
      }),
      NOW,
    );

    expect(result.visits).toBe(0);
    expect(result.totalVisits).toBe(7);
    expect(result.expiresAt).toBeNull();
    expect(result.currentLevel).toBeNull();
    expect(result.availableRewards).toEqual([]);
  });

  it('keeps the series when the last visit is exactly flameExpireDays old', () => {
    const result = buildLoyaltyBalance(
      settings(),
      balance({
        visits: 2,
        lastVisitAt: new Date(NOW.getTime() - 14 * DAY_MS),
      }),
      NOW,
    );

    expect(result.visits).toBe(2);
    expect(result.expiresAt).toBe(NOW.toISOString());
  });

  it('returns no rewards when rewards are disabled', () => {
    const result = buildLoyaltyBalance(
      settings({ flameRewardsEnabled: false }),
      balance({ visits: 3 }),
      NOW,
    );

    expect(result.rewardsEnabled).toBe(false);
    expect(result.currentLevel?.name).toBe('Бронза');
    expect(result.availableRewards).toEqual([]);
  });

  it('sorts levels by requiredVisits ascending', () => {
    const result = buildLoyaltyBalance(
      settings({ flameLevels: [levels[1], levels[0]] }),
      balance({ visits: 3 }),
      NOW,
    );

    expect(result.currentLevel?.requiredVisits).toBe(2);
    expect(result.nextLevel?.requiredVisits).toBe(5);
  });
});
