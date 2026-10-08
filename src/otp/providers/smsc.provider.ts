import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ISmsProvider, SmsSendResult } from '../interfaces/sms-provider.interface';

@Injectable()
export class SmscProvider implements ISmsProvider {
  readonly name = 'smsc' as const;
  private readonly logger = new Logger(SmscProvider.name);
  private readonly login: string;
  private readonly password: string;
  private readonly sender: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.login = this.configService.get<string>('smsc.login', '');
    this.password = this.configService.get<string>('smsc.password', '');
    this.sender = this.configService.get<string>('smsc.sender', 'Svels');
    this.apiUrl = this.configService.get<string>('smsc.apiUrl', 'https://smsc.ru/sys/send.php');
  }

  async send(phoneE164: string, message: string): Promise<SmsSendResult> {
    if (!this.login || !this.password) {
      return { ok: false, provider: this.name, error: 'CREDENTIALS_MISSING' };
    }

    try {
      const phone = phoneE164.replace(/\D/g, '');
      const url = new URL(this.apiUrl);
      url.searchParams.set('login', this.login);
      url.searchParams.set('psw', this.password);
      url.searchParams.set('phones', phone);
      url.searchParams.set('mes', message);
      url.searchParams.set('sender', this.sender);
      url.searchParams.set('fmt', '3');
      url.searchParams.set('charset', 'utf-8');

      const response = await fetch(url.toString(), { method: 'GET' });
      const data = (await response.json()) as {
        id?: number | string;
        error?: string;
        error_code?: number;
      };

      if (!response.ok || data.error || data.error_code) {
        const error = data.error ?? `HTTP_${response.status}`;
        this.logger.warn(`SMSC send failed: ${error}`);
        return { ok: false, provider: this.name, error };
      }

      return {
        ok: true,
        provider: this.name,
        messageId: data.id != null ? String(data.id) : undefined,
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'SMSC_ERROR';
      this.logger.warn(`SMSC send error: ${messageText}`);
      return { ok: false, provider: this.name, error: messageText };
    }
  }
}
