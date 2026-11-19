import { LoyaltyRewardType } from '../../common/enums/loyalty.enum';
import type { LoyaltyCartContext } from '../../loyalty/interfaces/loyalty-order-pricing.interface';
import { buildLoyaltyBalance } from '../../loyalty/loyalty-balance.util';
import type { LoyaltyRewardConfig } from '../../loyalty-settings/loyalty-settings.types';
import type { MenuItem } from '../../menu/entities/menu-item.entity';
import type { PreOrderItemModifierSnapshot } from '../types/pre-order-item-modifier.types';
import { resolveMenuItemLine } from './menu-item-line.util';
import { roundToKopecks } from './round-money.util';

export interface CartQuoteItemInput {
  menuItemId: string;
  quantity: number;
  modifierSelections?: Record<string, string[]>;
}

export interface CartQuoteLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: PreOrderItemModifierSnapshot[];
  lineTotal: number;
}

/**
 * Скидка текущего уровня, уже посчитанная в деньгах.
 * `percentOff` / `amountOff` — значения из настроек уровня.
 * `amount` — сколько реально вычли из подытога (после округления и потолка).
 */
export interface CartLoyaltyDiscount {
  levelId: string;
  levelName: string;
  rewardType: LoyaltyRewardType;
  percentOff: number | null;
  amountOff: number | null;
  amount: number;
}

export interface CartGiftReward {
  name: string;
}

export interface LoyaltyRewardSnapshot {
  discount: CartLoyaltyDiscount | null;
  gifts: CartGiftReward[];
}

/** Контракт POST .../pre-orders/quote и общая часть ответа расчёта. */
export interface CartQuoteResponse {
  lines: CartQuoteLine[];
  subtotal: number;
  loyaltyDiscount: CartLoyaltyDiscount | null;
  giftRewards: CartGiftReward[];
  total: number;
}

export interface CartQuote extends CartQuoteResponse {
  loyaltyLevelId: string | null;
  loyaltyLevelName: string | null;
  loyaltyRewardSnapshot: LoyaltyRewardSnapshot | null;
}

/**
 * Серверный расчёт корзины.
 *
 * Скидка только у авторизованного гостя и только при `flameRewardsEnabled`.
 * Уровень берётся из визитов так же, как в `buildLoyaltyBalance` (серия сгорает).
 * Пока гость на уровне, его скидка действует на каждый заказ.
 *
 * Если на уровне несколько скидок (процент и фикс, или несколько одного типа),
 * применяется одна — самая выгодная гостю: больший вычет в копейках после
 * `roundToKopecks` и ограничения сверху подытогом. При равной сумме выигрывает
 * процент (`percent_discount`), а при том же типе — награда, которая раньше
 * стоит в списке уровня.
 *
 * Фикс не уводит итог ниже нуля: вычет не больше подытога.
 * `minOrderAmount` награды: при подытоге ниже порога награда не действует.
 * Подарки (`free_menu_item`, `custom`) не меняют цену, в ответ попадают только имена.
 * Поля цены и скидки, присланные клиентом, эта функция не читает.
 */
export function priceCart(input: {
  userId?: string | null;
  items: CartQuoteItemInput[];
  menuItemsById: Map<string, MenuItem>;
  loyalty: LoyaltyCartContext | null;
  now: Date;
}): CartQuote {
  const lines = input.items.map((item) => {
    const priced = resolveMenuItemLine(
      input.menuItemsById.get(item.menuItemId),
      item.modifierSelections,
    );
    const lineTotal = roundToKopecks(priced.unitPrice * item.quantity);
    return {
      menuItemId: item.menuItemId,
      name: priced.name,
      quantity: item.quantity,
      unitPrice: priced.unitPrice,
      modifiers: priced.modifiers,
      lineTotal,
    };
  });

  const subtotal = roundToKopecks(
    lines.reduce((sum, line) => sum + line.lineTotal, 0),
  );

  const applied = resolveLoyalty(
    input.userId,
    input.loyalty,
    subtotal,
    input.now,
  );
  const discountAmount = applied.discount?.amount ?? 0;
  const total = roundToKopecks(subtotal - discountAmount);

  return {
    lines,
    subtotal,
    loyaltyDiscount: applied.discount,
    giftRewards: applied.gifts,
    total,
    loyaltyLevelId: applied.levelId,
    loyaltyLevelName: applied.levelName,
    loyaltyRewardSnapshot: applied.snapshot,
  };
}

function resolveLoyalty(
  userId: string | null | undefined,
  loyalty: LoyaltyCartContext | null,
  subtotal: number,
  now: Date,
): {
  discount: CartLoyaltyDiscount | null;
  gifts: CartGiftReward[];
  levelId: string | null;
  levelName: string | null;
  snapshot: LoyaltyRewardSnapshot | null;
} {
  const empty = {
    discount: null,
    gifts: [] as CartGiftReward[],
    levelId: null,
    levelName: null,
    snapshot: null,
  };

  if (!userId || !loyalty) {
    return empty;
  }

  const balance = buildLoyaltyBalance(loyalty.settings, loyalty.balance, now);
  if (!balance.rewardsEnabled || !balance.currentLevel) {
    return empty;
  }

  const rewards = balance.availableRewards;
  const discountReward = pickMostFavourableDiscount(subtotal, rewards);
  const gifts = rewards
    .filter((reward) => isGiftReward(reward) && meetsMinOrder(subtotal, reward))
    .map((reward) => ({ name: reward.title }));

  if (!discountReward && gifts.length === 0) {
    return empty;
  }

  const discount = discountReward
    ? toDiscount(
        balance.currentLevel.id,
        balance.currentLevel.name,
        discountReward,
      )
    : null;

  return {
    discount,
    gifts,
    levelId: balance.currentLevel.id,
    levelName: balance.currentLevel.name,
    snapshot: { discount, gifts },
  };
}

function pickMostFavourableDiscount(
  subtotal: number,
  rewards: LoyaltyRewardConfig[],
): { reward: LoyaltyRewardConfig; amount: number } | null {
  let best: { reward: LoyaltyRewardConfig; amount: number } | null = null;

  for (const reward of rewards) {
    const amount = discountAmount(subtotal, reward);
    if (amount == null) {
      continue;
    }
    const betterAmount = best != null && amount > best.amount;
    const sameAmountPrefersPercent =
      best != null &&
      amount === best.amount &&
      preferPercent(reward, best.reward);
    if (!best || betterAmount || sameAmountPrefersPercent) {
      best = { reward, amount };
    }
  }

  return best;
}

function preferPercent(
  candidate: LoyaltyRewardConfig,
  current: LoyaltyRewardConfig,
): boolean {
  return (
    candidate.type === LoyaltyRewardType.PERCENT_DISCOUNT &&
    current.type !== LoyaltyRewardType.PERCENT_DISCOUNT
  );
}

function discountAmount(
  subtotal: number,
  reward: LoyaltyRewardConfig,
): number | null {
  if (!isDiscountReward(reward) || !meetsMinOrder(subtotal, reward)) {
    return null;
  }

  if (reward.type === LoyaltyRewardType.PERCENT_DISCOUNT) {
    const percentOff = Number(reward.percentOff);
    if (!Number.isFinite(percentOff) || percentOff <= 0) {
      return null;
    }
    const raw = roundToKopecks((subtotal * percentOff) / 100);
    const amount = Math.min(subtotal, raw);
    return amount > 0 ? roundToKopecks(amount) : null;
  }

  const amountOff = Number(reward.amountOff);
  if (!Number.isFinite(amountOff) || amountOff <= 0) {
    return null;
  }
  const amount = Math.min(subtotal, roundToKopecks(amountOff));
  return amount > 0 ? roundToKopecks(amount) : null;
}

function toDiscount(
  levelId: string,
  levelName: string,
  picked: { reward: LoyaltyRewardConfig; amount: number },
): CartLoyaltyDiscount {
  const { reward, amount } = picked;
  return {
    levelId,
    levelName,
    rewardType: reward.type,
    percentOff:
      reward.type === LoyaltyRewardType.PERCENT_DISCOUNT
        ? Number(reward.percentOff)
        : null,
    amountOff:
      reward.type === LoyaltyRewardType.FIXED_DISCOUNT
        ? Number(reward.amountOff)
        : null,
    amount,
  };
}

function isDiscountReward(reward: LoyaltyRewardConfig): boolean {
  return (
    reward.type === LoyaltyRewardType.PERCENT_DISCOUNT ||
    reward.type === LoyaltyRewardType.FIXED_DISCOUNT
  );
}

function isGiftReward(reward: LoyaltyRewardConfig): boolean {
  return (
    reward.type === LoyaltyRewardType.FREE_MENU_ITEM ||
    reward.type === LoyaltyRewardType.CUSTOM
  );
}

function meetsMinOrder(subtotal: number, reward: LoyaltyRewardConfig): boolean {
  if (reward.minOrderAmount == null) {
    return true;
  }
  return subtotal >= Number(reward.minOrderAmount);
}
