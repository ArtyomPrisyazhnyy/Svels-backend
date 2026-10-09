export const RESTAURANT_TIMEZONE = 'Europe/Minsk';

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface MinskDateParts {
  dayOfWeek: number;
  hour: number;
  minute: number;
  year: number;
  month: number;
  day: number;
}

export function getMinskDateParts(date: Date): MinskDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: RESTAURANT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
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
    dayOfWeek: WEEKDAY_TO_INDEX[map.weekday] ?? 0,
    hour: Number(map.hour),
    minute: Number(map.minute),
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

export function minsDayBoundsInMinsk(dateYmd: string): {
  start: Date;
  end: Date;
} {
  const start = new Date(`${dateYmd}T00:00:00+03:00`);
  const end = new Date(`${dateYmd}T23:59:59.999+03:00`);
  return { start, end };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isRestaurantOpenAt(
  schedules: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isOpen: boolean;
  }>,
  at: Date,
): boolean {
  if (!schedules.length) {
    return true;
  }

  const { dayOfWeek, hour, minute } = getMinskDateParts(at);
  const nowMin = hour * 60 + minute;
  const daySchedules = schedules.filter(
    (s) => s.dayOfWeek === dayOfWeek && s.isOpen,
  );
  if (!daySchedules.length) {
    return false;
  }

  return daySchedules.some((schedule) => {
    const openMin = timeToMinutes(schedule.openTime.slice(0, 5));
    const closeMin = timeToMinutes(schedule.closeTime.slice(0, 5));
    return nowMin >= openMin && nowMin < closeMin;
  });
}
