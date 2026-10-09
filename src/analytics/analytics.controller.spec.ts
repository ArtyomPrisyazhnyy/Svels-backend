import { ANALYTICS_VISITS_THROTTLE } from './analytics-throttle.constants';
import { AnalyticsController } from './analytics.controller';

describe('AnalyticsController', () => {
  it('defines a dedicated throttle profile for POST /analytics/visits', () => {
    expect(ANALYTICS_VISITS_THROTTLE.default.limit).toBeGreaterThan(0);
    expect(ANALYTICS_VISITS_THROTTLE.default.ttl).toBe(60_000);
  });

  it('exposes trackVisit handler', () => {
    const controller = new AnalyticsController({
      trackVisit: jest.fn(),
    } as never);
    expect(typeof controller.trackVisit).toBe('function');
  });
});
