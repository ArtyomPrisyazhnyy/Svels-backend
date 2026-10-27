import {
  addDays,
  addMonths,
  effectiveSubscriptionStatus,
  isPublicVenueBlocked,
  nextStatusAfterPastDue,
  shouldMarkPastDue,
  shouldMarkSuspended,
} from './billing-status-machine';
import { SubscriptionStatus } from './enums/subscription-status.enum';

describe('billing status machine', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('marks active subscription past due when paidUntil elapsed', () => {
    expect(
      shouldMarkPastDue(
        SubscriptionStatus.ACTIVE,
        new Date('2026-06-01T00:00:00.000Z'),
        null,
        now,
      ),
    ).toBe(true);
  });

  it('marks trial past due when trial ended without payment', () => {
    expect(
      shouldMarkPastDue(
        SubscriptionStatus.TRIAL,
        null,
        new Date('2026-06-01T00:00:00.000Z'),
        now,
      ),
    ).toBe(true);
  });

  it('suspends after grace period from pastDueSince', () => {
    const pastDueSince = new Date('2026-06-01T00:00:00.000Z');
    expect(
      shouldMarkSuspended(SubscriptionStatus.PAST_DUE, pastDueSince, 7, now),
    ).toBe(true);
  });

  it('does not suspend before grace ends', () => {
    const pastDueSince = new Date('2026-06-10T00:00:00.000Z');
    expect(
      shouldMarkSuspended(SubscriptionStatus.PAST_DUE, pastDueSince, 7, now),
    ).toBe(false);
  });

  it('transitions trial and active to past_due', () => {
    expect(nextStatusAfterPastDue(SubscriptionStatus.TRIAL)).toBe(
      SubscriptionStatus.PAST_DUE,
    );
    expect(nextStatusAfterPastDue(SubscriptionStatus.ACTIVE)).toBe(
      SubscriptionStatus.PAST_DUE,
    );
  });

  it('blocks public access only for suspended and cancelled', () => {
    expect(isPublicVenueBlocked(SubscriptionStatus.SUSPENDED)).toBe(true);
    expect(isPublicVenueBlocked(SubscriptionStatus.CANCELLED)).toBe(true);
    expect(isPublicVenueBlocked(SubscriptionStatus.PAST_DUE)).toBe(false);
    expect(isPublicVenueBlocked(SubscriptionStatus.ACTIVE)).toBe(false);
  });

  it('addMonths extends paid period by one calendar month', () => {
    const start = new Date('2026-01-31T00:00:00.000Z');
    const next = addMonths(start, 1);
    expect(next.getUTCMonth()).toBe(2);
  });

  it('addDays adds whole days', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    expect(addDays(start, 7).toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });

  it('effective status becomes active when trial ended but paidUntil valid', () => {
    expect(
      effectiveSubscriptionStatus(
        SubscriptionStatus.TRIAL,
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-07-01T00:00:00.000Z'),
        now,
      ),
    ).toBe(SubscriptionStatus.ACTIVE);
  });
});
