import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ISmsProvider, SmsSendResult } from '../interfaces/sms-provider.interface';

@Injectable()
export class SmsByProvider implements ISmsProvider {
  readonly name = 'sms_by' as const;
  private readonly logger = new Logger(SmsByProvider.name);
  private readonly token: string;
  private readonly alphaname: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('smsBy.token', '');
    this.alphaname = this.configService.get<string>('smsBy.alphaname', 'Svels');
    this.apiUrl = this.configService.get<string>('smsBy.apiUrl', 'https://app.sms.by/api/v1');
  }

  async send(phoneE164: string, message: string): Promise<SmsSendResult> {
    if (!this.token) {
      return { ok: false, provider: this.name, error: 'TOKEN_MISSING' };
    }

    try {
      const phone = phoneE164.replace(/\D/g, '');
      const response = await fetch(`${this.apiUrl}/sendQuickSMS`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.token,
          message,
          phone,
          alphaname_id: this.alphaname,
        }),
      });

      const data = (await response.json()) as {
        status?: string | number;
        message_id?: string | number;
        error?: string;
        message?: string;
      };

      const ok =
        response.ok &&
        (data.status === 'ok' || data.status === 'OK' || data.status === 1 || Boolean(data.message_id));

      if (!ok) {
        const error = data.error ?? data.message ?? `HTTP_${response.status}`;
        this.logger.warn(`SMS.by send failed: ${error}`);
        return { ok: false, provider: this.name, error };
      }

      return {
        ok: true,
        provider: this.name,
        messageId: data.message_id != null ? String(data.message_id) : undefined,
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'SMS_BY_ERROR';
      this.logger.warn(`SMS.by send error: ${messageText}`);
      return { ok: false, provider: this.name, error: messageText };
    }
  }
}
