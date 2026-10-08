import { Module } from '@nestjs/common';
import {
  SMS_BY_PROVIDER,
  SMSC_PROVIDER,
  TELEGRAM_OTP_PROVIDER,
} from '../common/constants/injection-tokens';
import { AppCacheModule } from '../cache/cache.module';
import { OtpStoreService } from './otp-store.service';
import { DevSmsProvider } from './providers/dev-sms.provider';
import { SmsByProvider } from './providers/sms-by.provider';
import { SmsRouterService } from './providers/sms-router.service';
import { SmscProvider } from './providers/smsc.provider';
import { TelegramGatewayProvider } from './providers/telegram-gateway.provider';

@Module({
  imports: [AppCacheModule],
  providers: [
    OtpStoreService,
    DevSmsProvider,
    SmsRouterService,
    TelegramGatewayProvider,
    SmsByProvider,
    SmscProvider,
    { provide: TELEGRAM_OTP_PROVIDER, useExisting: TelegramGatewayProvider },
    { provide: SMS_BY_PROVIDER, useExisting: SmsByProvider },
    { provide: SMSC_PROVIDER, useExisting: SmscProvider },
  ],
  exports: [
    OtpStoreService,
    SmsRouterService,
    DevSmsProvider,
    TELEGRAM_OTP_PROVIDER,
    SMS_BY_PROVIDER,
    SMSC_PROVIDER,
  ],
})
export class OtpModule {}

