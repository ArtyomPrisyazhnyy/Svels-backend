import { LoyaltyRewardType } from '../common/enums/loyalty.enum';

export interface LoyaltyRewardConfig {
  id: string;
  type: LoyaltyRewardType;
  /** Короткое название для гостя. */
  title: string;
  description: string | null;
  percentOff: number | null;
  amountOff: number | null;
  menuItemId: string | null;
  minOrderAmount: number | null;
}

export interface FlameLevelConfig {
  id: string;
  name: string;
  /** Сколько подтверждённых визитов (заказов) нужно для уровня. */
  requiredVisits: number;
  rewards: LoyaltyRewardConfig[];
}

/** Зарезервировано под программы лояльности не на огоньке. */
export interface OtherLoyaltyProgramStub {
  id: string;
  enabled: boolean;
  name: string;
}
