import { LoyaltyRewardType } from '../../common/enums/loyalty.enum';
import type { LoyaltyCartContext } from '../../loyalty/interfaces/loyalty-order-pricing.interface';
import { GuestLoyaltyBalance } from '../../loyalty/entities/guest-loyalty-balance.entity';
import type {
  FlameLevelConfig,
  LoyaltyRewardConfig,
} from '../../loyalty-settings/loyalty-settings.types';
import type { MenuItem } from '../../menu/entities/menu-item.entity';
import { priceCart } from './cart-quote.util';

const NOW = new Date('2026-10-01T12:00:00.000Z');
const DAY_MS = 86_400_000;
const RESTAURANT_ID = '019efb61-5d8e-7058-b838-6f2696cb4204';
const USER_ID = '019efb61-5d8e-7058-b838-6f2696cb4202';
const ITEM_ID = '019efb61-5d8e-7058-b838-6f2696cb4201';
const LEVEL_ID = '019efb61-5d8e-7058-b838-6f2696cb4210';

function menuItem(price: number): MenuItem {
  return {
    id: ITEM_ID,
    name: 'Бургер',
    price,
    isAvailable: true,
    modifierGroups: [],
  } as unknown as MenuItem;
}

function reward(
  overrides: Partial<LoyaltyRewardConfig> & Pick<LoyaltyRewardConfig, 'type'>,
): LoyaltyRewardConfig {
  return {
    id: '019efb61-5d8e-7058-b838-6f2696cb4211',
    title: 'Награда',
    description: null,
    percentOff: null,
    amountOff: null,
    menuItemId: null,
    minOrderAmount: null,
    ...overrides,
  };
}

function level(
  rewards: LoyaltyRewardConfig[],
  requiredVisits = 2,
): FlameLevelConfig {
  return {
    id: LEVEL_ID,
    name: 'Искра',
    requiredVisits,
    rewards,
  };
}

function loyalty(
  rewards: LoyaltyRewardConfig[],
  options: {
    visits?: number;
    rewardsEnabled?: boolean;
    lastVisitAt?: Date | null;
    requiredVisits?: number;
  } = {},
): LoyaltyCartContext {
  const visits = options.visits ?? 3;
  const balance = Object.assign(new GuestLoyaltyBalance(), {
    restaurantId: RESTAURANT_ID,
    userId: USER_ID,
    visits,
    totalVisits: visits,
    lastVisitAt:
      options.lastVisitAt === undefined
        ? new Date(NOW.getTime() - DAY_MS)
        : options.lastVisitAt,
    updatedAt: NOW,
  });
  return {
    settings: {
      restaurantId: RESTAURANT_ID,
      flameDisplayEnabled: true,
      flameRewardsEnabled: options.rewardsEnabled ?? true,
      flameExpireDays: 14,
      flameLevels: [level(rewards, options.requiredVisits ?? 2)],
    },
    balance,
  };
}

function quote(options: {
  userId?: string | null;
  price?: number;
  quantity?: number;
  loyalty?: LoyaltyCartContext | null;
}) {
  return priceCart({
    userId: options.userId === undefined ? USER_ID : options.userId,
    items: [
      {
        menuItemId: ITEM_ID,
        quantity: options.quantity ?? 2,
        unitPrice: 1,
        discount: 999,
      } as never,
    ],
    menuItemsById: new Map([[ITEM_ID, menuItem(options.price ?? 10)]]),
    loyalty: options.loyalty === undefined ? null : options.loyalty,
    now: NOW,
  });
}

describe('priceCart', () => {
  it('charges the menu price when the guest has no level', () => {
    const result = quote({
      loyalty: loyalty([], { visits: 1, requiredVisits: 2 }),
    });

    expect(result.lines[0].unitPrice).toBe(10);
    expect(result.lines[0].lineTotal).toBe(20);
    expect(result.subtotal).toBe(20);
    expect(result.loyaltyDiscount).toBeNull();
    expect(result.giftRewards).toEqual([]);
    expect(result.total).toBe(20);
    expect(result.loyaltyLevelName).toBeNull();
  });

  it('applies the current level percent discount on every order', () => {
    const result = quote({
      loyalty: loyalty([
        reward({
          type: LoyaltyRewardType.PERCENT_DISCOUNT,
          title: '10%',
          percentOff: 10,
        }),
      ]),
    });

    expect(result.loyaltyDiscount).toEqual({
      levelId: LEVEL_ID,
      levelName: 'Искра',
      rewardType: LoyaltyRewardType.PERCENT_DISCOUNT,
      percentOff: 10,
      amountOff: null,
      amount: 2,
    });
    expect(result.subtotal).toBe(20);
    expect(result.total).toBe(18);
  });

  it('caps a fixed discount at the subtotal', () => {
    const result = quote({
      price: 10,
      quantity: 1,
      loyalty: loyalty([
        reward({
          type: LoyaltyRewardType.FIXED_DISCOUNT,
          title: '25 BYN',
          amountOff: 25,
        }),
      ]),
    });

    expect(result.subtotal).toBe(10);
    expect(result.loyaltyDiscount).toMatchObject({
      rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
      percentOff: null,
      amountOff: 25,
      amount: 10,
    });
    expect(result.total).toBe(0);
  });

  it('lists gift rewards by name and does not change the total', () => {
    const result = quote({
      loyalty: loyalty([
        reward({
          type: LoyaltyRewardType.CUSTOM,
          title: 'Кофе в подарок',
        }),
        reward({
          id: '019efb61-5d8e-7058-b838-6f2696cb4212',
          type: LoyaltyRewardType.FREE_MENU_ITEM,
          title: 'Десерт',
          menuItemId: ITEM_ID,
        }),
      ]),
    });

    expect(result.loyaltyDiscount).toBeNull();
    expect(result.giftRewards).toEqual([
      { name: 'Кофе в подарок' },
      { name: 'Десерт' },
    ]);
    expect(result.total).toBe(result.subtotal);
    expect(result.loyaltyLevelName).toBe('Искра');
  });

  it('does not apply rewards when the program is disabled', () => {
    const result = quote({
      loyalty: loyalty(
        [
          reward({
            type: LoyaltyRewardType.PERCENT_DISCOUNT,
            percentOff: 50,
          }),
          reward({
            type: LoyaltyRewardType.CUSTOM,
            title: 'Кофе в подарок',
          }),
        ],
        { rewardsEnabled: false },
      ),
    });

    expect(result.loyaltyDiscount).toBeNull();
    expect(result.giftRewards).toEqual([]);
    expect(result.total).toBe(20);
    expect(result.loyaltyRewardSnapshot).toBeNull();
  });

  it('does not discount a guest even if a loyalty context is passed', () => {
    const context = loyalty([
      reward({
        type: LoyaltyRewardType.PERCENT_DISCOUNT,
        percentOff: 50,
      }),
    ]);

    const result = quote({ userId: null, loyalty: context });

    expect(result.loyaltyDiscount).toBeNull();
    expect(result.giftRewards).toEqual([]);
    expect(result.total).toBe(20);
  });

  it('picks the single most favourable discount and prefers percent on a tie', () => {
    const percent = reward({
      type: LoyaltyRewardType.PERCENT_DISCOUNT,
      title: '10%',
      percentOff: 10,
    });
    const fixed = reward({
      id: '019efb61-5d8e-7058-b838-6f2696cb4213',
      type: LoyaltyRewardType.FIXED_DISCOUNT,
      title: '15 BYN',
      amountOff: 15,
    });

    const fixedWins = quote({
      price: 50,
      quantity: 2,
      loyalty: loyalty([percent, fixed]),
    });
    expect(fixedWins.subtotal).toBe(100);
    expect(fixedWins.loyaltyDiscount?.rewardType).toBe(
      LoyaltyRewardType.FIXED_DISCOUNT,
    );
    expect(fixedWins.loyaltyDiscount?.amount).toBe(15);
    expect(fixedWins.total).toBe(85);

    const tie = quote({
      price: 50,
      quantity: 2,
      loyalty: loyalty([
        reward({
          id: '019efb61-5d8e-7058-b838-6f2696cb4214',
          type: LoyaltyRewardType.FIXED_DISCOUNT,
          title: '10 BYN',
          amountOff: 10,
        }),
        reward({
          type: LoyaltyRewardType.PERCENT_DISCOUNT,
          percentOff: 10,
        }),
      ]),
    });
    expect(tie.loyaltyDiscount?.rewardType).toBe(
      LoyaltyRewardType.PERCENT_DISCOUNT,
    );
    expect(tie.loyaltyDiscount?.amount).toBe(10);
    expect(tie.loyaltyDiscount?.amountOff).toBeNull();
  });

  it('skips a reward below its minimum order amount', () => {
    const result = quote({
      loyalty: loyalty([
        reward({
          type: LoyaltyRewardType.PERCENT_DISCOUNT,
          percentOff: 50,
          minOrderAmount: 100,
        }),
        reward({
          type: LoyaltyRewardType.CUSTOM,
          title: 'Кофе в подарок',
          minOrderAmount: 100,
        }),
      ]),
    });

    expect(result.subtotal).toBe(20);
    expect(result.loyaltyDiscount).toBeNull();
    expect(result.giftRewards).toEqual([]);
    expect(result.total).toBe(20);
  });

  it('ignores an expired visit series the same way as the balance', () => {
    const result = quote({
      loyalty: loyalty(
        [
          reward({
            type: LoyaltyRewardType.FIXED_DISCOUNT,
            amountOff: 5,
          }),
        ],
        { lastVisitAt: new Date(NOW.getTime() - 30 * DAY_MS) },
      ),
    });

    expect(result.loyaltyDiscount).toBeNull();
    expect(result.total).toBe(20);
  });
});
