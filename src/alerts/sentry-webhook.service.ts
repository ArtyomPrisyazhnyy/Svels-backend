import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SentryAlertDedupeService } from './sentry-alert-dedupe.service';
import {
  extractSentryAlertContext,
  isActionableSentryWebhook,
} from './sentry-alert-message.formatter';
import { SentryTelegramNotifierService } from './sentry-telegram-notifier.service';

@Injectable()
export class SentryWebhookService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dedupe: SentryAlertDedupeService,
    private readonly telegram: SentryTelegramNotifierService,
  ) {}

  isWebhookConfigured(): boolean {
    const secret = this.configService.get<string>(
      'alerts.sentryWebhookSecret',
      '',
    );
    return Boolean(secret && this.telegram.isConfigured());
  }

  getWebhookSecret(): string {
    return this.configService.get<string>('alerts.sentryWebhookSecret', '');
  }

  async handlePayload(payload: Record<string, unknown>): Promise<{
    handled: boolean;
    notified: boolean;
  }> {
    if (!this.isWebhookConfigured()) {
      return { handled: false, notified: false };
    }

    if (!isActionableSentryWebhook(payload)) {
      return { handled: true, notified: false };
    }

    const context = extractSentryAlertContext(payload);
    if (!context) {
      return { handled: true, notified: false };
    }

    if (!this.dedupe.shouldNotify(context.issue.id)) {
      return { handled: true, notified: false };
    }

    const notified = await this.telegram.notify(context);
    return { handled: true, notified };
  }
}
