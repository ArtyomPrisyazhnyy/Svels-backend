import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevSmsProvider } from '../otp/providers/dev-sms.provider';

/**
 * Инструменты только для non-production (Playwright e2e).
 * В production все эндпоинты отвечают 403.
 */
@Controller('dev')
export class DevController {
  constructor(
    private readonly configService: ConfigService,
    private readonly devSms: DevSmsProvider,
  ) {}

  private assertNonProduction(): void {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev endpoints are disabled in production');
    }
  }

  @Get('last-otp')
  getLastOtp(@Query('phone') phone?: string): {
    phone: string;
    code: string;
    at: string;
  } {
    this.assertNonProduction();

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
