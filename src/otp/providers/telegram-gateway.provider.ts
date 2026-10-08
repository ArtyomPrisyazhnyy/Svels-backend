import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ITelegramOtpProvider,
  TelegramDeliveryPollResult,
  TelegramSendResult,
} from '../interfaces/telegram-otp-provider.interface';

interface GatewayResponse {
  ok?: boolean;
  error?: string;
  result?: {
    request_id?: string;
    delivery_status?: { status?: string };
    verification_status?: { status?: string };
  };
}

@Injectable()
export class TelegramGatewayProvider implements ITelegramOtpProvider {
  private readonly logger = new Logger(TelegramGatewayProvider.name);
  private readonly token: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('telegramGateway.token', '');
    this.apiUrl = this.configService.get<string>(
      'telegramGateway.apiUrl',
      'https://gatewayapi.telegram.org',
    );
  }

  async sendCode(phoneE164: string, code: string): Promise<TelegramSendResult> {
    if (!this.token) {
      this.logger.debug(
        'TELEGRAM_GATEWAY_TOKEN не задан — пропускаем Telegram',
      );
      return { ok: false, unavailable: true, error: 'TOKEN_MISSING' };
    }

    try {
      const ability = await this.call('checkSendAbility', {
        phone_number: phoneE164,
      });
      if (!ability.ok || !ability.result?.request_id) {
        return {
          ok: false,
          unavailable: true,
          error: ability.error ?? 'SEND_ABILITY_DENIED',
        };
      }

      const requestId = ability.result.request_id;
      const sent = await this.call('sendVerificationMessage', {
        phone_number: phoneE164,
        request_id: requestId,
        code,
        ttl: 30,
      });

      if (!sent.ok) {
        return {
          ok: false,
          unavailable: Boolean(sent.error),
          error: sent.error ?? 'SEND_FAILED',
          requestId,
        };
      }

      return { ok: true, requestId: sent.result?.request_id ?? requestId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TELEGRAM_ERROR';
      this.logger.warn(`Telegram Gateway send failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  async waitForDelivery(
    requestId: string,
    waitMs: number,
  ): Promise<TelegramDeliveryPollResult> {
    if (!this.token || !requestId) {
      return { delivered: false };
    }

    const deadline = Date.now() + waitMs;
    let lastStatus: string | undefined;

    while (Date.now() < deadline) {
      try {
        const status = await this.call('checkVerificationStatus', {
          request_id: requestId,
        });
        lastStatus = status.result?.delivery_status?.status;
        if (lastStatus === 'delivered' || lastStatus === 'read') {
          return { delivered: true, status: lastStatus };
        }
        if (lastStatus === 'expired' || lastStatus === 'revoked') {
          return { delivered: false, status: lastStatus };
        }
      } catch (error) {
        this.logger.debug(
          `Telegram poll error: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }

      await sleep(Math.min(1500, Math.max(400, deadline - Date.now())));
    }

    return { delivered: false, status: lastStatus };
  }

  async reportCodeChecked(requestId: string, code: string): Promise<void> {
    if (!this.token || !requestId) {
      return;
    }

    try {
      await this.call('checkVerificationStatus', {
        request_id: requestId,
        code,
      });
    } catch (error) {
      this.logger.debug(
        `Telegram reportCodeChecked failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private async call(
    method: string,
    body: Record<string, unknown>,
  ): Promise<GatewayResponse> {
    const response = await fetch(`${this.apiUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });

    const data = (await response.json()) as GatewayResponse;
    if (!response.ok && !data.error) {
      return { ok: false, error: `HTTP_${response.status}` };
    }
    return data;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
