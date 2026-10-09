import {
  Body,
  Controller,
  Headers,
  HttpCode,
  UnauthorizedException,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TelegramApiClient } from './telegram-api.client';
import { TelegramWebhookService } from './telegram-webhook.service';

@Controller()
export class TelegramWebhookController {
  constructor(
    private readonly webhookService: TelegramWebhookService,
    private readonly telegramApi: TelegramApiClient,
  ) {}

  @Post('telegram/webhook')
  @HttpCode(200)
  @SkipThrottle()
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') secretToken: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    const expected = this.telegramApi.getWebhookSecret();
    if (!expected || secretToken !== expected) {
      throw new UnauthorizedException();
    }

    await this.webhookService.handleUpdate(body as never);
    return { ok: true };
  }
}
