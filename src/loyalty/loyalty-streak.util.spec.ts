import {
  applyStreakOnVisit,
  computeStreakPresentation,
  isStreakExpiredByMinskDay,
  minskDateYmd,
  minskDaysBetween,
} from './loyalty-streak.util';

describe('loyalty-streak.util', () => {
  describe('minskDateYmd', () => {
    it('maps UTC times in the 00:00–03:00 Minsk window to the correct calendar day', () => {
      expect(minskDateYmd(new Date('2026-10-01T20:59:00.000Z'))).toBe(
        '2026-10-01',
      );
      expect(minskDateYmd(new Date('2026-10-01T21:00:00.000Z'))).toBe(
        '2026-10-02',
      );
      expect(minskDateYmd(new Date('2026-10-01T23:59:59.999Z'))).toBe(
        '2026-10-02',
      );
    });
  });

  describe('applyStreakOnVisit', () => {
    const expireDays = 14;

    it('starts a streak on the first visit', () => {
      const now = new Date('2026-10-01T21:30:00.000Z');
      const result = applyStreakOnVisit({
        streakDays: 0,
        streakStartedAt: null,
        lastVisitDay: null,
        longestStreak: 0,
        expireDays,
        now,
      });

      expect(result.streakDays).toBe(1);
      expect(result.lastVisitDay).toBe('2026-10-02');
      expect(result.streakStartedAt).toBe(now);
      expect(result.longestStreak).toBe(1);
    });

    it('does not increment streakDays for a second order on the same Minsk day', () => {
      const now = new Date('2026-10-01T22:00:00.000Z');
      const started = new Date('2026-10-01T21:30:00.000Z');
      const result = applyStreakOnVisit({
        streakDays: 1,
        streakStartedAt: started,
        lastVisitDay: '2026-10-02',
        longestStreak: 1,
        expireDays,
        now,
      });

      expect(result.streakDays).toBe(1);
      expect(result.lastVisitDay).toBe('2026-10-02');
      expect(result.streakStartedAt).toBe(started);
    });

    it('increments streakDays when the Minsk day changes across midnight (+03:00)', () => {
      const started = new Date('2026-10-01T12:00:00.000Z');
      const now = new Date('2026-10-01T21:30:00.000Z');
      const result = applyStreakOnVisit({
        streakDays: 2,
        streakStartedAt: started,
        lastVisitDay: '2026-10-01',
        longestStreak: 2,
        expireDays,
        now,
      });

      expect(result.streakDays).toBe(3);
      expect(result.lastVisitDay).toBe('2026-10-02');
      expect(result.streakStartedAt).toBe(started);
      expect(result.longestStreak).toBe(3);
    });

    it('resets the streak after more than expireDays Minsk days without a visit', () => {
      const now = new Date('2026-10-20T12:00:00.000Z');
      expect(isStreakExpiredByMinskDay('2026-10-01', expireDays, now)).toBe(
        true,
      );

      const result = applyStreakOnVisit({
        streakDays: 5,
        streakStartedAt: new Date('2026-09-28T10:00:00.000Z'),
        lastVisitDay: '2026-10-01',
        longestStreak: 5,
        expireDays,
        now,
      });

      expect(result.streakDays).toBe(1);
      expect(result.streakStartedAt).toBe(now);
      expect(result.longestStreak).toBe(5);
    });
  });

  describe('minskDaysBetween', () => {
    it('counts inclusive calendar-day distance in Minsk', () => {
      expect(minskDaysBetween('2026-10-01', '2026-10-02')).toBe(1);
      expect(minskDaysBetween('2026-10-01', '2026-10-15')).toBe(14);
    });
  });

  describe('computeStreakPresentation', () => {
    const expireDays = 14;
    const now = new Date('2026-10-10T12:00:00.000Z');

    it('returns none and zero streakDays when the streak expired', () => {
      const result = computeStreakPresentation({
        streakDays: 4,
        streakStartedAt: new Date('2026-09-20T10:00:00.000Z'),
        lastVisitDay: '2026-09-20',
        lastVisitAt: new Date('2026-09-20T10:00:00.000Z'),
        longestStreak: 7,
        expireDays,
        now,
      });

      expect(result).toEqual({
        streakDays: 0,
        streakStartedAt: null,
        longestStreak: 7,
        status: 'none',
      });
    });

    it('marks streak as expiring when flame expiry is within 24 hours', () => {
      const lastVisitAt = new Date(now.getTime() - 13 * 86_400_000 - 3_600_000);
      const result = computeStreakPresentation({
        streakDays: 3,
        streakStartedAt: new Date(lastVisitAt.getTime() - 2 * 86_400_000),
        lastVisitDay: minskDateYmd(lastVisitAt),
        lastVisitAt,
        longestStreak: 5,
        expireDays,
        now,
      });

      expect(result.streakDays).toBe(3);
      expect(result.status).toBe('expiring');
    });

    it('marks an in-window streak as active', () => {
      const lastVisitAt = new Date(now.getTime() - 2 * 86_400_000);
      const result = computeStreakPresentation({
        streakDays: 3,
        streakStartedAt: new Date(lastVisitAt.getTime() - 2 * 86_400_000),
        lastVisitDay: minskDateYmd(lastVisitAt),
        lastVisitAt,
        longestStreak: 5,
        expireDays,
        now,
      });

      expect(result.status).toBe('active');
      expect(result.streakDays).toBe(3);
    });
  });
});
