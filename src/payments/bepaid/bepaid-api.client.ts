import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BePaidCheckoutCreateParams,
  BePaidCheckoutCreateResult,
  BePaidCredentials,
  BePaidTransactionResult,
} from './bepaid.types';

@Injectable()
export class BePaidApiClient {
  private readonly logger = new Logger(BePaidApiClient.name);

  constructor(private readonly configService: ConfigService) {}

  assertCredentials(credentials: BePaidCredentials): void {
    if (!credentials.shopId?.trim() || !credentials.secretKey?.trim()) {
      throw new ServiceUnavailableException(
        'bePaid не настроен: укажите Shop ID и Secret Key в админке заведения',
      );
    }
  }

  async createCheckout(
    params: BePaidCheckoutCreateParams,
    credentials: BePaidCredentials,
  ): Promise<BePaidCheckoutCreateResult> {
    this.assertCredentials(credentials);

    const checkoutUrl = this.configService.get<string>(
      'bepaid.checkoutUrl',
      'https://checkout.bepaid.by',
    );

    const body = {
      checkout: {
        test: params.test,
        transaction_type: params.transactionType,
        attempts: 3,
        settings: {
          notification_url: params.notificationUrl,
          success_url: params.successUrl,
          fail_url: params.failUrl,
          decline_url: params.declineUrl,
          cancel_url: params.cancelUrl,
          language: 'ru',
        },
        order: {
          currency: params.currency,
          amount: params.amountMinor,
          description: params.description,
          tracking_id: params.trackingId,
          additional_data: {
            receipt_text: [params.description],
          },
        },
        customer: {
          ...(params.customerEmail ? { email: params.customerEmail } : {}),
          ...(params.customerPhone ? { phone: params.customerPhone } : {}),
          ...(params.customerFirstName
            ? { first_name: params.customerFirstName }
            : {}),
        },
      },
    };

    const response = await this.requestJson<{
      checkout?: { token?: string; redirect_url?: string };
      message?: string;
      errors?: unknown;
    }>(`${checkoutUrl}/ctp/api/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Version': '2',
        Authorization: this.basicAuthHeader(credentials),
      },
      body: JSON.stringify(body),
    });

    const token = response.checkout?.token;
    const redirectUrl = response.checkout?.redirect_url;
    if (!token || !redirectUrl) {
      this.logger.error(
        `bePaid checkout create failed: ${JSON.stringify(response)}`,
      );
      throw new BadGatewayException(
        response.message ?? 'bePaid не вернул токен оплаты',
      );
    }

    return { token, redirectUrl };
  }

  async capture(
    params: {
      parentUid: string;
      amountMinor: number;
      trackingId: string;
    },
    credentials: BePaidCredentials,
  ): Promise<BePaidTransactionResult> {
    this.assertCredentials(credentials);
    const gatewayUrl = this.configService.get<string>(
      'bepaid.gatewayUrl',
      'https://gateway.bepaid.by',
    );

    const response = await this.requestJson<{
      transaction?: Record<string, unknown>;
    }>(`${gatewayUrl}/transactions/captures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: this.basicAuthHeader(credentials),
      },
      body: JSON.stringify({
        request: {
          parent_uid: params.parentUid,
          amount: params.amountMinor,
          tracking_id: params.trackingId,
        },
      }),
    });

    return this.mapTransaction(response.transaction);
  }

  async void(
    params: {
      parentUid: string;
      amountMinor: number;
      trackingId: string;
    },
    credentials: BePaidCredentials,
  ): Promise<BePaidTransactionResult> {
    this.assertCredentials(credentials);
    const gatewayUrl = this.configService.get<string>(
      'bepaid.gatewayUrl',
      'https://gateway.bepaid.by',
    );

    const response = await this.requestJson<{
      transaction?: Record<string, unknown>;
    }>(`${gatewayUrl}/transactions/voids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: this.basicAuthHeader(credentials),
      },
      body: JSON.stringify({
        request: {
          parent_uid: params.parentUid,
          amount: params.amountMinor,
          tracking_id: params.trackingId,
        },
      }),
    });

    return this.mapTransaction(response.transaction);
  }

  async queryByCheckoutToken(
    token: string,
    credentials: BePaidCredentials,
  ): Promise<Record<string, unknown>> {
    this.assertCredentials(credentials);
    const checkoutUrl = this.configService.get<string>(
      'bepaid.checkoutUrl',
      'https://checkout.bepaid.by',
    );

    return this.requestJson<Record<string, unknown>>(
      `${checkoutUrl}/ctp/api/checkouts/${encodeURIComponent(token)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-Version': '2',
          Authorization: this.basicAuthHeader(credentials),
        },
      },
    );
  }

  private basicAuthHeader(credentials: BePaidCredentials): string {
    const token = Buffer.from(
      `${credentials.shopId}:${credentials.secretKey}`,
      'utf8',
    ).toString('base64');
    return `Basic ${token}`;
  }

  private asPrimitiveString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }

  private mapTransaction(
    transaction: Record<string, unknown> | undefined,
  ): BePaidTransactionResult {
    if (!transaction || typeof transaction.uid !== 'string') {
      throw new BadGatewayException('bePaid вернул пустой ответ транзакции');
    }

    return {
      uid: transaction.uid,
      parentUid:
        typeof transaction.parent_uid === 'string'
          ? transaction.parent_uid
          : null,
      status: this.asPrimitiveString(transaction.status),
      type: this.asPrimitiveString(transaction.type),
      amount: Number(transaction.amount ?? 0),
      currency: this.asPrimitiveString(transaction.currency),
      trackingId:
        typeof transaction.tracking_id === 'string'
          ? transaction.tracking_id
          : null,
      message:
        typeof transaction.message === 'string' ? transaction.message : null,
      test: Boolean(transaction.test),
      raw: transaction,
    };
  }

  private async requestJson<T>(url: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'network error';
      this.logger.error(`bePaid network error: ${message}`);
      throw new BadGatewayException('Не удалось связаться с bePaid');
    }

    const text = await response.text();
    let json: T | null = null;
    try {
      json = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      this.logger.error(
        `bePaid non-JSON (${response.status}): ${text.slice(0, 500)}`,
      );
      throw new BadGatewayException('Некорректный ответ bePaid');
    }

    if (!response.ok) {
      this.logger.error(
        `bePaid HTTP ${response.status}: ${text.slice(0, 800)}`,
      );
      throw new BadGatewayException(
        `bePaid ошибка ${response.status}: ${this.extractErrorMessage(json)}`,
      );
    }

    return json;
  }

  private extractErrorMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return 'unknown error';
    }
    const record = payload as { message?: string };
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    return JSON.stringify(payload).slice(0, 300);
  }
}
