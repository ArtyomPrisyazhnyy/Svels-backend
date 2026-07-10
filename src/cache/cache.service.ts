import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis | null;
  private readonly defaultTtl: number;
  private readonly enabled: boolean;
  private degraded = false;
  private degradationLogged = false;

  constructor(private readonly configService: ConfigService) {
    this.defaultTtl = this.configService.get<number>('redis.ttl', 3600);
    this.enabled = this.configService.get<boolean>('redis.enabled', true);

    if (!this.enabled) {
      this.client = null;
      this.logger.log('Redis cache disabled via configuration');
      return;
    }

    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      retryStrategy: () => null,
    });

    this.client.on('error', (error: Error) => {
      this.markDegraded(error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.client.status !== 'end') {
      this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isUsable()) {
      return null;
    }

    try {
      const raw = await this.client!.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      this.markDegraded(error instanceof Error ? error : undefined);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.isUsable()) {
      return;
    }

    try {
      const ttl = ttlSeconds ?? this.defaultTtl;
      await this.client!.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      this.markDegraded(error instanceof Error ? error : undefined);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isUsable()) {
      return;
    }

    try {
      await this.client!.del(key);
    } catch (error) {
      this.markDegraded(error instanceof Error ? error : undefined);
    }
  }

  /**
   * Атомарное удаление нескольких ключей через pipeline (правило data-transactions:
   * multi-key операции должны идти одним pipeline-батчем, а не N round-trip'ами).
   * Молча no-op в degraded-режиме.
   */
  async delMany(keys: string[]): Promise<void> {
    if (!this.isUsable() || keys.length === 0) {
      return;
    }

    try {
      const pipeline = this.client!.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      await pipeline.exec();
    } catch (error) {
      this.markDegraded(error instanceof Error ? error : undefined);
    }
  }

  /**
   * Redis-лок через SET NX EX (правило data-transactions / conn-pooling).
   * Возвращает токен, если лок захвачен, либо null, если ключ уже занят.
   * Best-effort: при недоступности Redis возвращает токен fallback
   * (реальная race-protection остаётся на SERIALIZABLE-транзакции БД).
   */
  async tryLock(key: string, ttlSeconds: number): Promise<string | null> {
    if (!this.isUsable()) {
      return `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await this.client!.set(key, token, 'EX', ttlSeconds, 'NX');
      return result === 'OK' ? token : null;
    } catch (error) {
      this.markDegraded(error instanceof Error ? error : undefined);
      return `fallback-${token}`;
    }
  }

  /**
   * Снятие лока с проверкой ownership (GET + DEL только если значение совпадает).
   * Гарантирует что мы не снимем чужой лок, истекший и перехваченный другим процессом.
   */
  async unlock(key: string, token: string): Promise<void> {
    if (!this.isUsable() || token.startsWith('fallback-')) {
      return;
    }

    try {
      const current = await this.client!.get(key);
      if (current === token) {
        await this.client!.del(key);
      }
    } catch (error) {
      this.markDegraded(error instanceof Error ? error : undefined);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.isUsable()) {
      return;
    }

    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) {
        await this.client!.del(...keys);
      }
    } catch (error) {
      this.markDegraded(error instanceof Error ? error : undefined);
    }
  }

  private isUsable(): boolean {
    return Boolean(this.client) && this.enabled && !this.degraded;
  }

  private markDegraded(error?: Error): void {
    this.degraded = true;

    if (this.degradationLogged) {
      return;
    }

    this.degradationLogged = true;
    const reason = error?.message ?? 'connection failed';
    this.logger.warn(`Redis unavailable (${reason}). Running without cache.`);
  }
}
