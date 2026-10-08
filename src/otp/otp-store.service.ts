import { createHash, randomInt, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import type { GuestOtpRecord, OtpDeliveryChannel } from './types/otp.types';

function tooManyRequests(message: string): never {
  throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

@Injectable()
export class OtpStoreService {
  private readonly ttlSeconds: number;
  private readonly resendSeconds: number;
  private readonly codeLength: number;
  private readonly maxVerifyAttempts: number;
  private readonly pepper: string;

  constructor(
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.ttlSeconds = this.configService.get<number>('otp.ttlSeconds', 300);
    this.resendSeconds = this.configService.get<number>(
      'otp.resendSeconds',
      60,
    );
    this.codeLength = this.configService.get<number>('otp.codeLength', 6);
    this.maxVerifyAttempts = this.configService.get<number>(
      'otp.maxVerifyAttempts',
      5,
    );
    this.pepper = this.configService.get<string>(
      'otp.pepper',
      'otp-dev-pepper',
    );
  }

  getTtlSeconds(): number {
    return this.ttlSeconds;
  }

  getResendSeconds(): number {
    return this.resendSeconds;
  }

  generateCode(): string {
    const max = 10 ** this.codeLength;
    const value = randomInt(0, max);
    return String(value).padStart(this.codeLength, '0');
  }

  hashCode(code: string, restaurantId: string, phone: string): string {
    return createHash('sha256')
      .update(`${this.pepper}:${restaurantId}:${phone}:${code}`)
      .digest('hex');
  }

  async get(
    restaurantId: string,
    phone: string,
  ): Promise<GuestOtpRecord | null> {
    try {
      return await this.cache.getRequired<GuestOtpRecord>(
        CacheKeys.guestOtp(restaurantId, phone),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Сервис подтверждения временно недоступен',
      );
    }
  }

  async save(record: GuestOtpRecord): Promise<void> {
    const ttl = Math.max(
      1,
      Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / 1000),
    );
    try {
      await this.cache.setRequired(
        CacheKeys.guestOtp(record.restaurantId, record.phone),
        record,
        ttl,
      );
    } catch {
      throw new ServiceUnavailableException(
        'Сервис подтверждения временно недоступен',
      );
    }
  }

  async delete(restaurantId: string, phone: string): Promise<void> {
    try {
      await this.cache.delRequired(CacheKeys.guestOtp(restaurantId, phone));
    } catch {
      throw new ServiceUnavailableException(
        'Сервис подтверждения временно недоступен',
      );
    }
  }

  assertCanResend(record: GuestOtpRecord | null): void {
    if (!record) {
      return;
    }
    const availableAt = new Date(record.resendAvailableAt).getTime();
    if (Date.now() < availableAt) {
      const waitSec = Math.ceil((availableAt - Date.now()) / 1000);
      tooManyRequests(`Повторная отправка будет доступна через ${waitSec} с`);
    }
  }

  createRecord(params: {
    restaurantId: string;
    phone: string;
    code: string;
    channel: OtpDeliveryChannel;
    country: 'BY' | 'RU';
    sendCount: number;
    telegramRequestId?: string;
  }): GuestOtpRecord {
    const now = Date.now();
    const record: GuestOtpRecord = {
      codeHash: this.hashCode(params.code, params.restaurantId, params.phone),
      phone: params.phone,
      restaurantId: params.restaurantId,
      channel: params.channel,
      createdAt: new Date(now).toISOString(),
      resendAvailableAt: new Date(
        now + this.resendSeconds * 1000,
      ).toISOString(),
      expiresAt: new Date(now + this.ttlSeconds * 1000).toISOString(),
      verifyAttempts: 0,
      sendCount: params.sendCount,
      country: params.country,
    };

    if (params.telegramRequestId) {
      record.telegramRequestId = params.telegramRequestId;
    }

    return record;
  }

  async verifyCode(
    restaurantId: string,
    phone: string,
    code: string,
  ): Promise<GuestOtpRecord> {
    if (!/^\d+$/.test(code) || code.length !== this.codeLength) {
      throw new BadRequestException('Некорректный формат кода');
    }

    const record = await this.get(restaurantId, phone);
    if (!record) {
      throw new UnauthorizedException(
        'Код не найден или истёк. Запросите новый',
      );
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await this.delete(restaurantId, phone);
      throw new UnauthorizedException('Код истёк. Запросите новый');
    }

    if (record.verifyAttempts >= this.maxVerifyAttempts) {
      await this.delete(restaurantId, phone);
      tooManyRequests('Слишком много попыток. Запросите новый код');
    }

    const expected = Buffer.from(record.codeHash, 'utf8');
    const actual = Buffer.from(
      this.hashCode(code, restaurantId, phone),
      'utf8',
    );
    const match =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!match) {
      record.verifyAttempts += 1;
      await this.save(record);
      throw new UnauthorizedException('Неверный код подтверждения');
    }

    return record;
  }
}
