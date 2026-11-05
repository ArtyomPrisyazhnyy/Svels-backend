import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

/** Redis-backed throttler storage (same Lua script as @nest-lab/throttler-storage-redis). */
@Injectable()
export class RedisThrottlerStorageService
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly scriptSrc: string;

  constructor(private readonly redis: Redis) {
    this.scriptSrc = this.getScriptSrc();
  }

  private getScriptSrc(): string {
    return `
      local hitKey = KEYS[1]
      local blockKey = KEYS[2]
      local throttlerName = ARGV[1]
      local ttl = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local blockDuration = tonumber(ARGV[4])

      local totalHits = redis.call('INCR', hitKey)
      local timeToExpire = redis.call('PTTL', hitKey)
      
      if timeToExpire <= 0 then
        redis.call('PEXPIRE', hitKey, ttl)
        timeToExpire = ttl
      end

      local isBlocked = redis.call('GET', blockKey)
      local timeToBlockExpire = 0

      if isBlocked then
        timeToBlockExpire = redis.call('PTTL', blockKey)
      elseif totalHits > limit then
        redis.call('SET', blockKey, 1, 'PX', blockDuration)
        isBlocked = '1'
        timeToBlockExpire = blockDuration
      end

      if isBlocked and timeToBlockExpire <= 0 then
        redis.call('DEL', blockKey)
        redis.call('SET', hitKey, 1, 'PX', ttl)
        totalHits = 1
        timeToExpire = ttl
        isBlocked = false
      end

      return { totalHits, timeToExpire, isBlocked and 1 or 0, timeToBlockExpire }
    `
      .replace(/^\s+/gm, '')
      .trim();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<Awaited<ReturnType<ThrottlerStorage['increment']>>> {
    const hitKey = `{${key}:${throttlerName}}:hits`;
    const blockKey = `{${key}:${throttlerName}}:blocked`;
    const results: unknown = await this.redis.call(
      'eval',
      this.scriptSrc,
      2,
      hitKey,
      blockKey,
      throttlerName,
      ttl,
      limit,
      blockDuration,
    );

    if (!Array.isArray(results)) {
      throw new TypeError(
        `Expected result to be array of values, got ${String(results)}`,
      );
    }

    const tuple = results as unknown[];
    const totalHits = tuple[0];
    const timeToExpire = tuple[1];
    const isBlocked = tuple[2];
    const timeToBlockExpire = tuple[3];

    if (typeof totalHits !== 'number') {
      throw new TypeError('Expected totalHits to be a number');
    }
    if (typeof timeToExpire !== 'number') {
      throw new TypeError('Expected timeToExpire to be a number');
    }
    if (typeof isBlocked !== 'number') {
      throw new TypeError('Expected isBlocked to be a number');
    }
    if (typeof timeToBlockExpire !== 'number') {
      throw new TypeError('Expected timeToBlockExpire to be a number');
    }

    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpire / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpire / 1000),
    };
  }

  onModuleDestroy(): void {
    // Caller owns the Redis client lifecycle (lazyConnect in throttler.config).
  }
}
