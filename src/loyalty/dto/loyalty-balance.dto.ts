import type { LoyaltyRewardConfig } from '../../loyalty-settings/loyalty-settings.types';

export interface LoyaltyBalanceResponseDto {
  restaurantId: string;
  userId: string;
  enabled: boolean;
  rewardsEnabled: boolean;
  visits: number;
  totalVisits: number;
  lastVisitAt: string | null;
  expiresAt: string | null;
  currentLevel: { id: string; name: string; requiredVisits: number } | null;
  nextLevel: {
    id: string;
    name: string;
    requiredVisits: number;
    visitsLeft: number;
  } | null;
  availableRewards: LoyaltyRewardConfig[];
}
