import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { DevSmsProvider } from '../otp/providers/dev-sms.provider';

/**
 * Инструменты только для локальной разработки (Playwright e2e).
 * Модуль регистрируется только при ENABLE_DEV_ENDPOINTS=true.
 */
@Controller('dev')
export class DevController {
  constructor(private readonly devSms: DevSmsProvider) {}

  @Get('last-otp')
  getLastOtp(@Query('phone') phone?: string): {
    phone: string;
    code: string;
    at: string;
  } {
    if (!phone?.trim()) {
      throw new BadRequestException('phone is required');
    }

    const record = this.devSms.getLastCode(phone);
    if (!record) {
      throw new NotFoundException('OTP for this phone was not found');
    }

    return {
      phone: phone.replace(/\D/g, ''),
      code: record.code,
      at: record.at,
    };
  }
}
