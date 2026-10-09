const isProd = process.env.NODE_ENV === 'production';

export const ANALYTICS_VISITS_THROTTLE = {
  default: { limit: isProd ? 30 : 500, ttl: 60_000 },
} as const;
