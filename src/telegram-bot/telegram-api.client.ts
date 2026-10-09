import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TELEGRAM_BOT_CONFIG_KEY } from './telegram-bot.config';

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  result?: {
    message_id?: number;
  };
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data: string;
}

@Injectable()
export class TelegramApiClient implements OnModuleInit {
  private readonly logger = new Logger(TelegramApiClient.name);
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>(
      `${TELEGRAM_BOT_CONFIG_KEY}.botToken`,
      '',
    );
  }

  onModuleInit(): void {
    if (!this.botToken) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN не задан — отправка в Telegram отключена',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.botToken);
  }

  getWebhookSecret(): string {
    return this.configService.get<string>(
      `${TELEGRAM_BOT_CONFIG_KEY}.webhookSecret`,
      '',
    );
  }

  getBotUsername(): string {
    return this.configService.get<string>(
      `${TELEGRAM_BOT_CONFIG_KEY}.botUsername`,
      '',
    );
  }

  async sendMessage(
    chatId: string,
    text: string,
    options?: {
      replyMarkup?: {
        inline_keyboard: TelegramInlineKeyboardButton[][];
      };
    },
  ): Promise<number | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }

    const response = await this.post('sendMessage', body);
    const messageId = response.result?.message_id;
    return messageId ?? null;
  }

  async editMessageText(
    chatId: string,
    messageId: number | string,
    text: string,
    options?: {
      replyMarkup?: {
        inline_keyboard: TelegramInlineKeyboardButton[][];
      } | null;
    },
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: Number(messageId),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (options && 'replyMarkup' in options) {
      body.reply_markup = options.replyMarkup ?? { inline_keyboard: [] };
    }

    const response = await this.post('editMessageText', body);
    return Boolean(response.ok);
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    options?: { text?: string; showAlert?: boolean },
  ): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    const body: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };
    if (options?.text) {
      body.text = options.text;
    }
    if (options?.showAlert) {
      body.show_alert = true;
    }

    await this.post('answerCallbackQuery', body);
  }

  private async post(
    method: string,
    body: Record<string, unknown>,
  ): Promise<TelegramApiResponse> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/${method}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = (await response.json()) as TelegramApiResponse;
      if (!data.ok) {
        this.logger.warn(
          `Telegram API ${method} failed: ${data.description ?? response.status}`,
        );
      }
      return data;
    } catch (error) {
      this.logger.error(`Telegram API ${method} error`, error);
      return { ok: false };
    }
  }
}
