import type { LoyaltyBalanceSettings } from '../loyalty-balance.util';
import type { GuestLoyaltyBalance } from '../entities/guest-loyalty-balance.entity';

/** Настройки огонька и баланс визитов гостя — вход расчёта скидки в корзине. */
export interface LoyaltyCartContext {
  settings: LoyaltyBalanceSettings;
  balance: GuestLoyaltyBalance | null;
}

/**
 * Чтение лояльности для предзаказа. Модуль заказов не ходит в таблицы лояльности сам.
 */
export interface ILoyaltyOrderPricing {
  loadForCart(
    restaurantId: string,
    userId: string,
  ): Promise<LoyaltyCartContext>;
}
