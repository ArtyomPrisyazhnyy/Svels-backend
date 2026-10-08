import { ConfigService } from '@nestjs/config';
import {
  buildLeadTelegramMessage,
  escapeTelegramHtml,
  formatLeadContactChannels,
  LeadTelegramNotifierService,
} from './lead-telegram-notifier.service';
import { LandingLead } from './entities/landing-lead.entity';

describe('LeadTelegramNotifierService helpers', () => {
  it('escapes Telegram HTML', () => {
    expect(escapeTelegramHtml('Tom & <Jerry>')).toBe('Tom &amp; &lt;Jerry&gt;');
  });

  it('formats selected contact channels', () => {
    expect(
      formatLeadContactChannels({
        contactTelegram: true,
        contactWhatsapp: false,
        contactViber: false,
      }),
    ).toBe('Telegram');
  });

  it('builds lead message with escaped user input', () => {
    const lead = {
      id: '019ef5f4-49d3-757f-9a8a-f9458e52fd65',
      name: 'Иван <script>',
      phone: '+375 29 000-00-00',
      contactTelegram: false,
      contactWhatsapp: true,
      contactViber: false,
      note: 'Нужен домен & приложение',
      source: 'landing',
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
    } satisfies LandingLead;

    expect(buildLeadTelegramMessage(lead)).toContain('<b>Имя:</b> Иван &lt;script&gt;');
    expect(buildLeadTelegramMessage(lead)).toContain('<b>Связаться через:</b> WhatsApp');
    expect(buildLeadTelegramMessage(lead)).toContain(
      '<b>Комментарий:</b> Нужен домен &amp; приложение',
    );
  });
});

describe('LeadTelegramNotifierService', () => {
  const lead: LandingLead = {
    id: '019ef5f4-49d3-757f-9a8a-f9458e52fd65',
    name: 'Иван',
    phone: '+375290000000',
    contactTelegram: true,
    contactWhatsapp: false,
    contactViber: false,
    note: null,
    source: 'landing',
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
  };

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('skips notification when telegram is not configured', async () => {
    const service = new LeadTelegramNotifierService({
      get: () => '',
    } as ConfigService);

    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(service.notifyLead(lead)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends notification when telegram is configured', async () => {
    const service = new LeadTelegramNotifierService({
      get: (key: string) => {
        if (key === 'leads.telegramBotToken') return 'bot-token';
        if (key === 'leads.telegramChatId') return '12345';
        return '';
      },
    } as ConfigService);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(service.notifyLead(lead)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
