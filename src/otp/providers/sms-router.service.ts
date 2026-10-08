import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SMS_BY_PROVIDER,
  SMSC_PROVIDER,
} from '../../common/constants/injection-tokens';
import {
  getPhoneCountry,
  type PhoneCountry,
} from '../../common/utils/normalize-phone.util';
import type {
  ISmsProvider,
  SmsSendResult,
} from '../interfaces/sms-provider.interface';
import { DevSmsProvider } from './dev-sms.provider';

@Injectable()
export class SmsRouterService {
  private readonly logger = new Logger(SmsRouterService.name);
  private readonly isProd: boolean;

  constructor(
    @Inject(SMS_BY_PROVIDER) private readonly smsBy: ISmsProvider,
    @Inject(SMSC_PROVIDER) private readonly smsc: ISmsProvider,
    private readonly devSms: DevSmsProvider,
    private readonly configService: ConfigService,
  ) {
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  async sendOtp(phoneNormalized: string, code: string): Promise<SmsSendResult> {
    const country = getPhoneCountry(phoneNormalized);
    const phoneE164 = `+${phoneNormalized}`;
    const message = `Ваш код входа Svels: ${code}`;
    const provider = this.pickProvider(country);

    const result = await provider.send(phoneE164, message);
    if (result.ok) {
      this.logger.log(
        `OTP SMS sent country=${country} provider=${result.provider} phone=***${phoneNormalized.slice(-4)}`,
      );
      return result;
    }

    // В non-prod — fallback в лог, чтобы можно было тестировать без ключей.
    if (!this.isProd) {
      this.logger.warn(
        `SMS provider ${provider.name} failed (${result.error}). Falling back to DEV SMS.`,
      );
      return this.devSms.send(phoneE164, message);
    }

    this.logger.error(
      `OTP SMS failed country=${country} provider=${result.provider} error=${result.error}`,
    );
    return result;
  }

  private pickProvider(country: PhoneCountry): ISmsProvider {
    return country === 'BY' ? this.smsBy : this.smsc;
  }
}
