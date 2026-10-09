import { isRestaurantOpenAt } from './minsk-time.util';

describe('isRestaurantOpenAt', () => {
  it('treats empty schedule as always open', () => {
    expect(isRestaurantOpenAt([], new Date('2026-06-01T12:00:00+03:00'))).toBe(
      true,
    );
  });

  it('returns false outside working hours', () => {
    const schedules = [
      {
        dayOfWeek: 1,
        openTime: '09:00:00',
        closeTime: '18:00:00',
        isOpen: true,
      },
    ];
    expect(
      isRestaurantOpenAt(schedules, new Date('2026-06-01T20:00:00+03:00')),
    ).toBe(false);
  });

  it('returns true inside working hours (Monday)', () => {
    const schedules = [
      {
        dayOfWeek: 1,
        openTime: '09:00:00',
        closeTime: '22:00:00',
        isOpen: true,
      },
    ];
    expect(
      isRestaurantOpenAt(schedules, new Date('2026-06-01T12:00:00+03:00')),
    ).toBe(true);
  });
});
