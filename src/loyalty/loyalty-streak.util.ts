export const LOYALTY_TIMEZONE = 'Europe/Minsk';

const DAY_MS = 86_400_000;

export type LoyaltyStreakStatus = 'none' | 'active' | 'expiring';

export function getMinskDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: LOYALTY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

export function minskDateYmd(date: Date): string {
  const { year, month, day } = getMinskDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Calendar days from earlierYmd to laterYmd (both inclusive endpoints as dates). */
export function minskDaysBetween(earlierYmd: string, laterYmd: string): number {
  const start = new Date(`${earlierYmd}T00:00:00+03:00`).getTime();
  const end = new Date(`${laterYmd}T00:00:00+03:00`).getTime();
  return Math.round((end - start) / DAY_MS);
}

export function isVisitSeriesExpired(
  lastVisitAt: Date | null,
  expireDays: number,
  now: Date,
): boolean {
  return (
    lastVisitAt !== null &&
    now.getTime() - lastVisitAt.getTime() > expireDays * DAY_MS
  );
}

export function isStreakExpiredByMinskDay(
  lastVisitDay: string | null,
  expireDays: number,
  now: Date,
): boolean {
  if (lastVisitDay === null) {
    return true;
  }
  const today = minskDateYmd(now);
  return minskDaysBetween(lastVisitDay, today) > expireDays;
}

export function computeStreakPresentation(params: {
  streakDays: number;
  streakStartedAt: Date | null;
  lastVisitDay: string | null;
  lastVisitAt: Date | null;
  longestStreak: number;
  expireDays: number;
  now: Date;
}): {
  streakDays: number;
  streakStartedAt: string | null;
  longestStreak: number;
  status: LoyaltyStreakStatus;
} {
  const {
    streakDays: storedStreakDays,
    streakStartedAt,
    lastVisitDay,
    lastVisitAt,
    longestStreak,
    expireDays,
    now,
  } = params;

  const expiredByDay = isStreakExpiredByMinskDay(lastVisitDay, expireDays, now);
  const expiredByVisit = isVisitSeriesExpired(lastVisitAt, expireDays, now);
  const expired = expiredByDay || expiredByVisit;

  if (storedStreakDays <= 0 || lastVisitDay === null || expired) {
    return {
      streakDays: 0,
      streakStartedAt: null,
      longestStreak,
      status: 'none',
    };
  }

  const expireMs = expireDays * DAY_MS;
  const streakExpiresAtMs =
    lastVisitAt !== null ? lastVisitAt.getTime() + expireMs : null;
  const msUntilExpiry =
    streakExpiresAtMs !== null ? streakExpiresAtMs - now.getTime() : null;

  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  let status: LoyaltyStreakStatus = 'active';
  if (
    msUntilExpiry !== null &&
    msUntilExpiry > 0 &&
    msUntilExpiry <= twentyFourHoursMs
  ) {
    status = 'expiring';
  }

  return {
    streakDays: storedStreakDays,
    streakStartedAt: streakStartedAt ? streakStartedAt.toISOString() : null,
    longestStreak,
    status,
  };
}

export interface ApplyStreakOnVisitParams {
  streakDays: number;
  streakStartedAt: Date | null;
  lastVisitDay: string | null;
  longestStreak: number;
  expireDays: number;
  now: Date;
}

export function applyStreakOnVisit(
  current: ApplyStreakOnVisitParams,
): ApplyStreakOnVisitParams {
  const today = minskDateYmd(current.now);
  const streakExpired = isStreakExpiredByMinskDay(
    current.lastVisitDay,
    current.expireDays,
    current.now,
  );

  let streakDays = current.streakDays;
  let streakStartedAt = current.streakStartedAt;
  let lastVisitDay = current.lastVisitDay;
  let longestStreak = current.longestStreak;

  if (streakExpired || lastVisitDay === null) {
    streakStartedAt = current.now;
    streakDays = 1;
    lastVisitDay = today;
  } else if (lastVisitDay !== today) {
    streakDays += 1;
    lastVisitDay = today;
  }

  longestStreak = Math.max(longestStreak, streakDays);

  return {
    streakDays,
    streakStartedAt,
    lastVisitDay,
    longestStreak,
    expireDays: current.expireDays,
    now: current.now,
  };
}
