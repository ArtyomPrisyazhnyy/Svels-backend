import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildSentryAlertTelegramMessage,
  type SentryAlertContext,
} from './sentry-alert-message.formatter';

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
}

@Injectable()
export class SentryTelegramNotifierService {
  private readonly logger = new Logger(SentryTelegramNotifierService.name);
  private readonly botToken: string;
  private readonly chatId: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>(
      'alerts.errorsTelegramBotToken',
      '',
    );
    this.chatId = this.configService.get<string>(
      'alerts.errorsTelegramChatId',
      '',
    );
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  async notify(context: SentryAlertContext): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: buildSentryAlertTelegramMessage(context),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(8_000),
        },
      );

      const data = (await response.json()) as TelegramApiResponse;
      if (!response.ok || !data.ok) {
        this.logger.warn(
          `Не удалось отправить алерт Sentry в Telegram: ${data.description ?? `HTTP_${response.status}`}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Ошибка отправки алерта Sentry в Telegram: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return false;
    }
  }
}
