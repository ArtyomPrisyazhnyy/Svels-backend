import { SubscriptionStatus } from './enums/subscription-status.enum';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export function shouldMarkPastDue(
  status: SubscriptionStatus,
  paidUntil: Date | null,
  trialEndsAt: Date | null,
  now: Date,
): boolean {
  if (status === SubscriptionStatus.CANCELLED) {
    return false;
  }
  if (status === SubscriptionStatus.SUSPENDED) {
    return false;
  }
  if (status === SubscriptionStatus.TRIAL) {
    return Boolean(trialEndsAt && trialEndsAt < now);
  }
  if (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.PAST_DUE) {
    return Boolean(paidUntil && paidUntil < now);
  }
  return false;
}

export function shouldMarkSuspended(
  status: SubscriptionStatus,
  pastDueSince: Date | null,
  gracePeriodDays: number,
  now: Date,
): boolean {
  if (status !== SubscriptionStatus.PAST_DUE || !pastDueSince) {
    return false;
  }
  const graceEnds = addDays(pastDueSince, gracePeriodDays);
  return now >= graceEnds;
}

export function nextStatusAfterPastDue(
  current: SubscriptionStatus,
): SubscriptionStatus {
  if (current === SubscriptionStatus.TRIAL) {
    return SubscriptionStatus.PAST_DUE;
  }
  if (current === SubscriptionStatus.ACTIVE) {
    return SubscriptionStatus.PAST_DUE;
  }
  return current;
}

export function isPublicVenueBlocked(status: SubscriptionStatus): boolean {
  return (
    status === SubscriptionStatus.SUSPENDED ||
    status === SubscriptionStatus.CANCELLED
  );
}

export function effectiveSubscriptionStatus(
  status: SubscriptionStatus,
  trialEndsAt: Date | null,
  paidUntil: Date | null,
  now: Date,
): SubscriptionStatus {
  if (status === SubscriptionStatus.TRIAL && trialEndsAt && trialEndsAt < now) {
    if (paidUntil && paidUntil >= now) {
      return SubscriptionStatus.ACTIVE;
    }
    return SubscriptionStatus.PAST_DUE;
  }
  return status;
}
