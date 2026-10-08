import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LandingLead } from './entities/landing-lead.entity';

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatLeadContactChannels(lead: Pick<LandingLead, 'contactTelegram' | 'contactWhatsapp' | 'contactViber'>): string {
  const channels: string[] = [];
  if (lead.contactTelegram) channels.push('Telegram');
  if (lead.contactWhatsapp) channels.push('WhatsApp');
  if (lead.contactViber) channels.push('Viber');
  return channels.join(', ');
}

export function buildLeadTelegramMessage(lead: LandingLead): string {
  const lines = [
    '<b>Новая заявка с лендинга Svels</b>',
    '',
    `<b>Имя:</b> ${escapeTelegramHtml(lead.name)}`,
    `<b>Телефон:</b> ${escapeTelegramHtml(lead.phone)}`,
    `<b>Связаться через:</b> ${escapeTelegramHtml(formatLeadContactChannels(lead))}`,
  ];

  if (lead.note) {
    lines.push(`<b>Комментарий:</b> ${escapeTelegramHtml(lead.note)}`);
  }

  lines.push('', `<i>ID: ${lead.id}</i>`);
  return lines.join('\n');
}

@Injectable()
export class LeadTelegramNotifierService {
  private readonly logger = new Logger(LeadTelegramNotifierService.name);
  private readonly botToken: string;
  private readonly chatId: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('leads.telegramBotToken', '');
    this.chatId = this.configService.get<string>('leads.telegramChatId', '');
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  async notifyLead(lead: LandingLead): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.debug(
        'LEADS_TELEGRAM_BOT_TOKEN или LEADS_TELEGRAM_CHAT_ID не заданы — уведомление пропущено',
      );
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
            text: buildLeadTelegramMessage(lead),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(8_000),
        },
      );

      const data = (await response.json()) as TelegramApiResponse;
      if (!response.ok || !data.ok) {
        this.logger.warn(
          `Не удалось отправить заявку в Telegram: ${data.description ?? `HTTP_${response.status}`}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Ошибка отправки заявки в Telegram: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return false;
    }
  }
}
