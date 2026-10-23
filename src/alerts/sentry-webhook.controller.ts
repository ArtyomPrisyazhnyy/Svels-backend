import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequestWithRawBody } from '../common/fastify/sentry-webhook-raw-body';
import { verifySentryWebhookSignature } from './sentry-webhook-signature';
import { SentryWebhookService } from './sentry-webhook.service';

@Controller('api/internal')
export class SentryWebhookController {
  constructor(private readonly webhookService: SentryWebhookService) {}

  @Post('sentry-webhook')
  @HttpCode(200)
  @SkipThrottle()
  async handleWebhook(
    @Req() request: FastifyRequestWithRawBody,
    @Headers('sentry-hook-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: true; skipped?: boolean; notified?: boolean }> {
    if (!this.webhookService.isWebhookConfigured()) {
      return { ok: true, skipped: true };
    }

    const secret = this.webhookService.getWebhookSecret();
    const rawBody = request.rawBody;
    if (!verifySentryWebhookSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException();
    }

    const result = await this.webhookService.handlePayload(body);
    return {
      ok: true,
      notified: result.notified,
    };
  }
}
