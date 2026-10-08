import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { generateUuidV7 } from '../common/utils/uuid.util';
import type { RestaurantBePaidCredentials } from '../payment-settings/dto/payment-settings.dto';
import { PaymentSettingsService } from '../payment-settings/payment-settings.service';
import { PreOrder } from '../pre-orders/entities/pre-order.entity';
import { BePaidApiClient } from './bepaid/bepaid-api.client';
import { PaymentResponseDto } from './dto/payment.dto';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PreOrder)
    private readonly preOrderRepository: Repository<PreOrder>,
    private readonly bePaidApiClient: BePaidApiClient,
    private readonly paymentSettingsService: PaymentSettingsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Создаёт запись Payment + checkout token bePaid (холд или сразу payment).
   */
  async startOnlineCheckout(params: {
    restaurantId: string;
    preOrderId: string;
    userId: string;
    amount: number;
    description: string;
    customerFirstName?: string;
    customerPhone?: string;
  }): Promise<PaymentResponseDto> {
    const credentials = await this.paymentSettingsService.resolveCredentials(
      params.restaurantId,
    );

    const amountMinor = this.toMinorUnits(params.amount);
    if (amountMinor < 1) {
      throw new BadRequestException('Сумма оплаты слишком мала');
    }

    const paymentId = generateUuidV7();
    const trackingId = `preorder:${params.preOrderId}:${paymentId.slice(0, 8)}`;
    const siteUrl = this.configService.get<string>(
      'bepaid.siteUrl',
      'http://localhost:3001',
    );
    const returnBase = `${siteUrl.replace(/\/$/, '')}/restaurants/${params.restaurantId}/payment/result`;
    const returnQuery = `preOrderId=${encodeURIComponent(params.preOrderId)}&paymentId=${encodeURIComponent(paymentId)}`;

    const checkout = await this.bePaidApiClient.createCheckout(
      {
        amountMinor,
        currency: credentials.currency,
        description: params.description.slice(0, 255),
        trackingId,
        transactionType: credentials.checkoutTransactionType,
        test: credentials.testMode,
        notificationUrl: this.resolveNotificationUrl(),
        successUrl: `${returnBase}?${returnQuery}&status=success`,
        failUrl: `${returnBase}?${returnQuery}&status=fail`,
        declineUrl: `${returnBase}?${returnQuery}&status=decline`,
        cancelUrl: `${returnBase}?${returnQuery}&status=cancel`,
        customerFirstName: params.customerFirstName,
        customerPhone: params.customerPhone,
      },
      credentials,
    );

    const payment = this.paymentRepository.create({
      id: paymentId,
      restaurantId: params.restaurantId,
      preOrderId: params.preOrderId,
      userId: params.userId,
      provider: 'bepaid',
      status: PaymentStatus.PENDING,
      amount: params.amount,
      amountMinor,
      currency: credentials.currency,
      trackingId,
      checkoutToken: checkout.token,
      redirectUrl: checkout.redirectUrl,
      bepaidUid: null,
      parentUid: null,
      test: credentials.testMode,
      transactionType: credentials.checkoutTransactionType,
      lastMessage: null,
      lastPayload: null,
    });

    const saved = await this.paymentRepository.save(payment);
    return this.toResponse(saved);
  }

  async getByIdForUser(
    paymentId: string,
    userId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.findOwnedPayment(paymentId, userId);
    return this.toResponse(payment);
  }

  async getByPreOrderForUser(
    preOrderId: string,
    userId: string,
  ): Promise<PaymentResponseDto | null> {
    const [payment] = await this.paymentRepository.find({
      where: { preOrderId, userId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return payment ? this.toResponse(payment) : null;
  }

  /** Синхронизация статуса с bePaid по токену (когда webhook не достучался локально). */
  async syncFromCheckoutToken(
    paymentId: string,
    userId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.findOwnedPayment(paymentId, userId);
    if (!payment.checkoutToken) {
      return this.toResponse(payment);
    }

    if (
      payment.status === PaymentStatus.CAPTURED ||
      payment.status === PaymentStatus.VOIDED
    ) {
      return this.toResponse(payment);
    }

    const credentials = await this.paymentSettingsService.resolveCredentials(
      payment.restaurantId,
    );
    const payload = await this.bePaidApiClient.queryByCheckoutToken(
      payment.checkoutToken,
      credentials,
    );
    await this.applyCheckoutQueryPayload(payment, payload, credentials);
    const refreshed = await this.paymentRepository.findOneByOrFail({
      id: payment.id,
    });
    return this.toResponse(refreshed);
  }

  async handleBePaidWebhook(
    authorizationHeader: string | undefined,
    body: Record<string, unknown>,
  ): Promise<void> {
    const webhookCreds =
      await this.paymentSettingsService.verifyWebhookBasicAuth(
        authorizationHeader,
      );
    if (!webhookCreds) {
      throw new BadRequestException('Неверный Authorization webhook bePaid');
    }

    // Формат checkout widget
    if (typeof body.token === 'string') {
      const payment = await this.paymentRepository.findOne({
        where: { checkoutToken: body.token },
      });
      if (!payment) {
        this.logger.warn(
          `Webhook checkout: payment not found for token ${body.token}`,
        );
        return;
      }
      if (
        webhookCreds.restaurantId &&
        payment.restaurantId !== webhookCreds.restaurantId
      ) {
        this.logger.warn(
          `Webhook shop mismatch: payment restaurant ${payment.restaurantId} vs auth ${webhookCreds.restaurantId}`,
        );
        return;
      }
      const credentials = webhookCreds.restaurantId
        ? webhookCreds
        : await this.paymentSettingsService.resolveCredentials(
            payment.restaurantId,
          );
      await this.applyCheckoutQueryPayload(payment, body, credentials);
      return;
    }

    // Формат card gateway
    const transaction = body.transaction;
    if (transaction && typeof transaction === 'object') {
      await this.applyGatewayTransaction(
        transaction as Record<string, unknown>,
        webhookCreds,
      );
      return;
    }

    this.logger.warn(
      `Unknown bePaid webhook shape: ${JSON.stringify(body).slice(0, 400)}`,
    );
  }

  async captureByPreOrder(
    restaurantId: string,
    preOrderId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.findLatestPayment(restaurantId, preOrderId);
    const credentials =
      await this.paymentSettingsService.resolveCredentials(restaurantId);
    return this.capturePayment(payment, credentials);
  }

  async voidByPreOrder(
    restaurantId: string,
    preOrderId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.findLatestPayment(restaurantId, preOrderId);
    if (payment.status === PaymentStatus.VOIDED) {
      return this.toResponse(payment);
    }
    if (payment.status !== PaymentStatus.AUTHORIZED || !payment.bepaidUid) {
      throw new BadRequestException('Нет активного холда для отмены');
    }

    const credentials =
      await this.paymentSettingsService.resolveCredentials(restaurantId);
    const result = await this.bePaidApiClient.void(
      {
        parentUid: payment.bepaidUid,
        amountMinor: payment.amountMinor,
        trackingId: payment.trackingId,
      },
      credentials,
    );

    if (result.status !== 'successful') {
      payment.lastMessage = result.message;
      payment.lastPayload = result.raw;
      await this.paymentRepository.save(payment);
      throw new BadRequestException(result.message ?? 'Void отклонён');
    }

    payment.status = PaymentStatus.VOIDED;
    payment.parentUid = payment.bepaidUid;
    payment.bepaidUid = result.uid;
    payment.lastMessage = result.message;
    payment.lastPayload = result.raw;
    await this.paymentRepository.save(payment);
    await this.preOrderRepository.update(
      { id: payment.preOrderId },
      { status: PreOrderStatus.CANCELLED },
    );

    return this.toResponse(payment);
  }

  private async capturePayment(
    payment: Payment,
    credentials: RestaurantBePaidCredentials,
  ): Promise<PaymentResponseDto> {
    if (payment.status === PaymentStatus.CAPTURED) {
      return this.toResponse(payment);
    }
    if (payment.status !== PaymentStatus.AUTHORIZED || !payment.bepaidUid) {
      throw new BadRequestException('Нет активного холда для списания');
    }

    const result = await this.bePaidApiClient.capture(
      {
        parentUid: payment.bepaidUid,
        amountMinor: payment.amountMinor,
        trackingId: payment.trackingId,
      },
      credentials,
    );

    if (result.status !== 'successful') {
      payment.status = PaymentStatus.FAILED;
      payment.lastMessage = result.message;
      payment.lastPayload = result.raw;
      await this.paymentRepository.save(payment);
      throw new BadRequestException(result.message ?? 'Capture отклонён');
    }

    payment.status = PaymentStatus.CAPTURED;
    payment.parentUid = payment.bepaidUid;
    payment.bepaidUid = result.uid;
    payment.lastMessage = result.message;
    payment.lastPayload = result.raw;
    await this.paymentRepository.save(payment);
    await this.preOrderRepository.update(
      { id: payment.preOrderId },
      { status: PreOrderStatus.PAID },
    );

    return this.toResponse(payment);
  }

  private async applyCheckoutQueryPayload(
    payment: Payment,
    payload: Record<string, unknown>,
    credentials: RestaurantBePaidCredentials,
  ): Promise<void> {
    payment.lastPayload = payload;

    if (payload.expired === true) {
      payment.status = PaymentStatus.EXPIRED;
      payment.lastMessage =
        typeof payload.message === 'string' ? payload.message : 'Token expired';
      await this.paymentRepository.save(payment);
      return;
    }

    const gatewayResponse = payload.gateway_response;
    if (!gatewayResponse || typeof gatewayResponse !== 'object') {
      await this.paymentRepository.save(payment);
      return;
    }

    const gateway = gatewayResponse as Record<string, unknown>;
    const authOrPayment =
      (gateway.authorization as Record<string, unknown> | undefined) ??
      (gateway.payment as Record<string, unknown> | undefined) ??
      (gateway.transaction as Record<string, unknown> | undefined);

    if (!authOrPayment) {
      await this.paymentRepository.save(payment);
      return;
    }

    await this.applyGatewayTransaction(
      {
        ...authOrPayment,
        tracking_id: payment.trackingId,
        test: payload.test ?? payment.test,
        type:
          authOrPayment.type ??
          (gateway.authorization
            ? 'authorization'
            : gateway.payment
              ? 'payment'
              : undefined),
      },
      credentials,
    );
  }

  private async applyGatewayTransaction(
    transaction: Record<string, unknown>,
    credentialsHint?: RestaurantBePaidCredentials | null,
  ): Promise<void> {
    const trackingId =
      typeof transaction.tracking_id === 'string'
        ? transaction.tracking_id
        : null;
    const uid = typeof transaction.uid === 'string' ? transaction.uid : null;
    if (!trackingId && !uid) {
      return;
    }

    let payment =
      (trackingId
        ? await this.paymentRepository.findOne({ where: { trackingId } })
        : null) ??
      (uid
        ? await this.paymentRepository.findOne({ where: { bepaidUid: uid } })
        : null);

    if (!payment) {
      this.logger.warn(
        `Payment not found for bePaid tx tracking=${trackingId} uid=${uid}`,
      );
      return;
    }

    if (
      credentialsHint?.restaurantId &&
      payment.restaurantId !== credentialsHint.restaurantId
    ) {
      this.logger.warn(`Webhook restaurant mismatch for payment ${payment.id}`);
      return;
    }

    // Терминальные статусы не откатываем повторными webhook/query.
    if (
      payment.status === PaymentStatus.CAPTURED ||
      payment.status === PaymentStatus.VOIDED
    ) {
      payment.lastPayload = transaction;
      if (typeof transaction.message === 'string') {
        payment.lastMessage = transaction.message;
      }
      await this.paymentRepository.save(payment);
      return;
    }

    const status = String(transaction.status ?? '');
    const type = String(transaction.type ?? payment.transactionType ?? '');
    payment.bepaidUid = uid ?? payment.bepaidUid;
    payment.lastMessage =
      typeof transaction.message === 'string'
        ? transaction.message
        : payment.lastMessage;
    payment.lastPayload = transaction;
    payment.test = Boolean(transaction.test ?? payment.test);
    payment.transactionType = type || payment.transactionType;

    if (status === 'successful') {
      if (
        type === 'authorization' ||
        payment.transactionType === 'authorization'
      ) {
        payment.status = PaymentStatus.AUTHORIZED;
        await this.paymentRepository.save(payment);
        await this.preOrderRepository.update(
          { id: payment.preOrderId },
          { status: PreOrderStatus.CONFIRMED },
        );

        const credentials = credentialsHint?.secretKey
          ? credentialsHint
          : await this.paymentSettingsService.resolveCredentials(
              payment.restaurantId,
            );

        if (credentials.autoCapture && payment.bepaidUid) {
          try {
            await this.capturePayment(payment, credentials);
          } catch (error) {
            this.logger.warn(
              `Auto-capture failed for ${payment.id}: ${
                error instanceof Error ? error.message : 'unknown'
              }`,
            );
          }
        }
        return;
      }

      if (type === 'payment' || type === 'capture') {
        payment.status = PaymentStatus.CAPTURED;
        await this.paymentRepository.save(payment);
        await this.preOrderRepository.update(
          { id: payment.preOrderId },
          { status: PreOrderStatus.PAID },
        );
        return;
      }

      if (type === 'void') {
        payment.status = PaymentStatus.VOIDED;
        await this.paymentRepository.save(payment);
        await this.preOrderRepository.update(
          { id: payment.preOrderId },
          { status: PreOrderStatus.CANCELLED },
        );
        return;
      }
    }

    if (status === 'failed' || status === 'error' || status === 'incomplete') {
      payment.status = PaymentStatus.FAILED;
      await this.paymentRepository.save(payment);
      return;
    }

    await this.paymentRepository.save(payment);
  }

  private async findOwnedPayment(
    paymentId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });
    if (!payment) {
      throw new NotFoundException('Платёж не найден');
    }
    return payment;
  }

  private async findLatestPayment(
    restaurantId: string,
    preOrderId: string,
  ): Promise<Payment> {
    const [payment] = await this.paymentRepository.find({
      where: { restaurantId, preOrderId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    if (!payment) {
      throw new NotFoundException('Платёж по заказу не найден');
    }
    return payment;
  }

  private resolveNotificationUrl(): string {
    const explicit = this.configService.get<string>(
      'bepaid.notificationUrl',
      '',
    );
    if (explicit.trim()) {
      return explicit.trim();
    }
    const apiPublicUrl = this.configService
      .get<string>('bepaid.apiPublicUrl', 'http://127.0.0.1:3000')
      .replace(/\/$/, '');
    return `${apiPublicUrl}/payments/bepaid/webhook`;
  }

  private toMinorUnits(amount: number): number {
    return Math.round(Number(amount) * 100);
  }

  private toResponse(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      restaurantId: payment.restaurantId,
      preOrderId: payment.preOrderId,
      status: payment.status,
      amount: Number(payment.amount),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      trackingId: payment.trackingId,
      redirectUrl: payment.redirectUrl,
      checkoutToken: payment.checkoutToken,
      bepaidUid: payment.bepaidUid,
      test: payment.test,
      transactionType: payment.transactionType,
      lastMessage: payment.lastMessage,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
