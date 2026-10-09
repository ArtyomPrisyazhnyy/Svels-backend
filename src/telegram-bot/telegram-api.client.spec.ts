import { ConfigService } from '@nestjs/config';
import { TelegramApiClient } from './telegram-api.client';

describe('TelegramApiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not call fetch when bot token is missing', async () => {
    const client = new TelegramApiClient({
      get: () => '',
    } as ConfigService);

    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(client.sendMessage('1', 'hi')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends message with HTML parse mode when configured', async () => {
    const client = new TelegramApiClient({
      get: (key: string) => {
        if (key === 'telegramBot.botToken') return 'bot-token';
        return '';
      },
    } as ConfigService);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 99 } }),
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(client.sendMessage('123', '<b>test</b>')).resolves.toBe(99);
    const [, requestInit] = fetchMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(requestInit.method).toBe('POST');
    expect(requestInit.body).toContain('"parse_mode":"HTML"');
  });
});
