import { Injectable, Logger } from '@nestjs/common';
import type {
  ISmsProvider,
  SmsSendResult,
} from '../interfaces/sms-provider.interface';

/**
 * Dev/fallback SMS: пишет код в лог, если боевые провайдеры не настроены.
 * В production не должен быть единственным путём — оркестратор бросит ошибку.
 * Хранит последний код в памяти для e2e (GET /dev/last-otp).
 */
@Injectable()
export class DevSmsProvider implements ISmsProvider {
  readonly name = 'dev' as const;
  private readonly logger = new Logger(DevSmsProvider.name);
  private readonly lastCodes = new Map<string, { code: string; at: string }>();

  async send(phoneE164: string, message: string): Promise<SmsSendResult> {
    this.logger.warn(`[DEV SMS] to=${phoneE164} message=${message}`);

    const match = message.match(/(\d{4,8})/);
    if (match?.[1]) {
      const phone = phoneE164.replace(/\D/g, '');
      this.lastCodes.set(phone, {
        code: match[1],
        at: new Date().toISOString(),
      });
    }

    return { ok: true, provider: this.name, messageId: `dev-${Date.now()}` };
  }

  getLastCode(
    phoneNormalizedOrE164: string,
  ): { code: string; at: string } | null {
    const phone = phoneNormalizedOrE164.replace(/\D/g, '');
    return this.lastCodes.get(phone) ?? null;
  }
}
