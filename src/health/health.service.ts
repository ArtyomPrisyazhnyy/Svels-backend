import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { RESTAURANTS_SERVICE } from '../common/constants/injection-tokens';
import type { RestaurantsDomainResolver } from '../common/interfaces/restaurants-domain-resolver.interface';

export type HealthCheckResult = {
  status: 'ok' | 'error';
  db: 'up' | 'down';
  redis: 'up' | 'disabled';
};

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    @Inject(RESTAURANTS_SERVICE)
    private readonly restaurantsService: RestaurantsDomainResolver,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const db = await this.checkDatabase();
    const redis = this.checkRedis();

    return {
      status: db === 'up' ? 'ok' : 'error',
      db,
      redis,
    };
  }

  private async checkDatabase(): Promise<'up' | 'down'> {
    if (!this.dataSource.isInitialized) {
      return 'down';
    }

    const raw = process.env.DB_HEALTH_CHECK_TIMEOUT_MS?.trim();
    const timeoutMs = raw ? parseInt(raw, 10) : 2_000;
    const effectiveTimeout =
      Number.isNaN(timeoutMs) || timeoutMs <= 0 ? 2_000 : timeoutMs;

    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('health check timeout')),
            effectiveTimeout,
          );
        }),
      ]);
      return 'up';
    } catch {
      return 'down';
    }
  }

  async isCustomDomainAllowed(domain: string): Promise<boolean> {
    try {
      await this.restaurantsService.resolveByDomain(domain);
      return true;
    } catch {
      return false;
    }
  }

  private checkRedis(): 'up' | 'disabled' {
    const enabled = this.configService.get<boolean>('redis.enabled', true);
    if (!enabled) {
      return 'disabled';
    }
    return this.cacheService.isAvailable() ? 'up' : 'disabled';
  }
}
