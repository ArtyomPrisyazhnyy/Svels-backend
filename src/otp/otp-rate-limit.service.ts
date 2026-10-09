import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { throwOtpRateLimited } from './otp-rate-limit.exception';

const HOUR_SECONDS = 3600;
const MINUTE_SECONDS = 60;

interface MemoryCounter {
  count: number;
  expiresAtMs: number;
}

@Injectable()
export class OtpRateLimitService {
  private readonly memory = new Map<string, MemoryCounter>();

  constructor(private readonly cache: CacheService) {}

  async assertCanSendOtp(phone: string, clientIp: string): Promise<void> {
    const phoneMinuteKey = `otp:rate:phone:60s:${phone}`;
    const phoneHourKey = `otp:rate:phone:hour:${phone}`;
    const ipHourKey = `otp:rate:ip:hour:${clientIp}`;

    const [phoneMinute, phoneHour, ipHour] = await Promise.all([
      this.getCount(phoneMinuteKey),
      this.getCount(phoneHourKey),
      this.getCount(ipHourKey),
    ]);

    if (phoneMinute >= 1) {
      throwOtpRateLimited(
        'Код уже отправлен. Повторная отправка будет доступна через минуту',
      );
    }
    if (phoneHour >= 5) {
      throwOtpRateLimited(
        'Превышен лимит отправки кодов на этот номер. Попробуйте позже',
      );
    }
    if (ipHour >= 20) {
      throwOtpRateLimited(
        'Превышен лимит отправки кодов с вашего IP. Попробуйте позже',
      );
    }
  }

  async recordOtpSent(phone: string, clientIp: string): Promise<void> {
    const phoneMinuteKey = `otp:rate:phone:60s:${phone}`;
    const phoneHourKey = `otp:rate:phone:hour:${phone}`;
    const ipHourKey = `otp:rate:ip:hour:${clientIp}`;

    await Promise.all([
      this.increment(phoneMinuteKey, MINUTE_SECONDS),
      this.increment(phoneHourKey, HOUR_SECONDS),
      this.increment(ipHourKey, HOUR_SECONDS),
    ]);
  }

  private async getCount(key: string): Promise<number> {
    if (this.cache.isAvailable()) {
      return this.cache.getCounter(key);
    }
    return this.getMemoryCount(key);
  }

  private async increment(key: string, ttlSeconds: number): Promise<void> {
    if (this.cache.isAvailable()) {
      await this.cache.incrementCounter(key, ttlSeconds);
      return;
    }
    this.incrementMemory(key, ttlSeconds);
  }

  private getMemoryCount(key: string): number {
    const entry = this.memory.get(key);
    if (!entry) {
      return 0;
    }
    if (entry.expiresAtMs <= Date.now()) {
      this.memory.delete(key);
      return 0;
    }
    return entry.count;
  }

  private incrementMemory(key: string, ttlSeconds: number): void {
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAtMs <= now) {
      this.memory.set(key, {
        count: 1,
        expiresAtMs: now + ttlSeconds * 1000,
      });
      return;
    }
    entry.count += 1;
  }
}
