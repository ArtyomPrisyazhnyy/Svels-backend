import { Logger, Module } from '@nestjs/common';
import { SentryAlertDedupeService } from './sentry-alert-dedupe.service';
import { SentryTelegramNotifierService } from './sentry-telegram-notifier.service';
import { SentryWebhookController } from './sentry-webhook.controller';
import { SentryWebhookService } from './sentry-webhook.service';

@Module({
  controllers: [SentryWebhookController],
  providers: [
    SentryWebhookService,
    SentryTelegramNotifierService,
    SentryAlertDedupeService,
  ],
})
export class AlertsModule {
  private static warnedNoOp = false;

  constructor(private readonly webhookService: SentryWebhookService) {
    if (
      !AlertsModule.warnedNoOp &&
      !this.webhookService.isWebhookConfigured()
    ) {
      AlertsModule.warnedNoOp = true;
      new Logger(AlertsModule.name).warn(
        'SENTRY_WEBHOOK_SECRET / ERRORS_TELEGRAM_* не заданы — модуль alerts в режиме no-op',
      );
    }
  }
}
