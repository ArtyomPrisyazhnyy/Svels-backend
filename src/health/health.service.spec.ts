import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const createService = (options: {
    dbUp: boolean;
    redisEnabled: boolean;
    redisAvailable: boolean;
  }) => {
    const dataSource = {
      isInitialized: true,
      query: jest.fn().mockImplementation(() => {
        if (!options.dbUp) {
          return Promise.reject(new Error('db down'));
        }
        return Promise.resolve([{ '?column?': 1 }]);
      }),
    } as unknown as DataSource;

    const cacheService = {
      isAvailable: jest.fn().mockReturnValue(options.redisAvailable),
    } as unknown as CacheService;

    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'redis.enabled') {
          return options.redisEnabled;
        }
        return defaultValue;
      }),
    } as unknown as ConfigService;

    const restaurantsService = {
      resolveByDomain: jest.fn(),
    };

    return new HealthService(
      dataSource,
      cacheService,
      configService,
      restaurantsService,
    );
  };

  it('returns ok when database is up and redis is available', async () => {
    const service = createService({
      dbUp: true,
      redisEnabled: true,
      redisAvailable: true,
    });
    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      redis: 'up',
    });
  });

  it('returns redis disabled when redis is turned off', async () => {
    const service = createService({
      dbUp: true,
      redisEnabled: false,
      redisAvailable: false,
    });
    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      redis: 'disabled',
    });
  });

  it('returns error when database is down', async () => {
    const service = createService({
      dbUp: false,
      redisEnabled: true,
      redisAvailable: true,
    });
    await expect(service.check()).resolves.toEqual({
      status: 'error',
      db: 'down',
      redis: 'up',
    });
  });
});
