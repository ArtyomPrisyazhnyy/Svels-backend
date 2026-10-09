import type { LoyaltySettingsResponseDto } from '../loyalty-settings/dto/loyalty-settings.dto';
import type { LoyaltyBalanceResponseDto } from './dto/loyalty-balance.dto';
import type { GuestLoyaltyBalance } from './entities/guest-loyalty-balance.entity';

const DAY_MS = 86_400_000;

export type LoyaltyBalanceSettings = Pick<
  LoyaltySettingsResponseDto,
  | 'restaurantId'
  | 'flameDisplayEnabled'
  | 'flameRewardsEnabled'
  | 'flameExpireDays'
  | 'flameLevels'
>;

export type LoyaltyBalanceSnapshot = Omit<LoyaltyBalanceResponseDto, 'userId'>;

export function buildLoyaltyBalance(
  settings: LoyaltyBalanceSettings,
  balance: GuestLoyaltyBalance | null,
  now: Date,
): LoyaltyBalanceSnapshot {
  const expireMs = settings.flameExpireDays * DAY_MS;
  const lastVisitAt = balance?.lastVisitAt ?? null;
  const expired =
    lastVisitAt !== null && now.getTime() - lastVisitAt.getTime() > expireMs;
  const visits = balance && !expired ? balance.visits : 0;
  const expiresAt =
    visits > 0 && lastVisitAt !== null
      ? new Date(lastVisitAt.getTime() + expireMs)
      : null;

  const levels = [...settings.flameLevels].sort(
    (a, b) => a.requiredVisits - b.requiredVisits,
  );
  const reached = levels.filter((level) => level.requiredVisits <= visits);
  const currentLevel = reached.length > 0 ? reached[reached.length - 1] : null;
  const nextLevel =
    levels.find((level) => level.requiredVisits > visits) ?? null;

  return {
    restaurantId: settings.restaurantId,
    enabled: settings.flameDisplayEnabled,
    rewardsEnabled: settings.flameRewardsEnabled,
    visits,
    totalVisits: balance?.totalVisits ?? 0,
    lastVisitAt: lastVisitAt ? lastVisitAt.toISOString() : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    currentLevel: currentLevel
      ? {
          id: currentLevel.id,
          name: currentLevel.name,
          requiredVisits: currentLevel.requiredVisits,
        }
      : null,
    nextLevel: nextLevel
      ? {
          id: nextLevel.id,
          name: nextLevel.name,
          requiredVisits: nextLevel.requiredVisits,
          visitsLeft: nextLevel.requiredVisits - visits,
        }
      : null,
    availableRewards:
      settings.flameRewardsEnabled && currentLevel ? currentLevel.rewards : [],
  };
}
