import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';

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

    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch {
      return 'down';
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
