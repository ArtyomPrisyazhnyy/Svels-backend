jest.mock('../common/utils/uuid.util', () => ({
  generateUuidV7: jest.fn(() => '019efb61-5d8e-7058-b838-6f2696cb4200'),
}));

import { OrderPaymentStatus } from '../common/enums/order-payment-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';

type ApplyGatewayTransaction = (
  transaction: Record<string, unknown>,
  credentialsHint?: { restaurantId: string; secretKey: string } | null,
) => Promise<void>;

function getApplyGatewayTransaction(
  service: PaymentsService,
): ApplyGatewayTransaction {
  const target = service as unknown as {
    applyGatewayTransaction: ApplyGatewayTransaction;
  };
  return target.applyGatewayTransaction.bind(
    service,
  ) as ApplyGatewayTransaction;
}

describe('PaymentsService.applyGatewayTransaction paymentStatus', () => {
  const paymentRepository = {
    findOne: jest.fn(),
    save: jest.fn((p: Payment) => Promise.resolve(p)),
  };
  const preOrderRepository = {
    update: jest.fn().mockResolvedValue(undefined),
  };
  const bePaidApiClient = {};
  const paymentSettingsService = {
    resolveCredentials: jest.fn(),
  };
  const configService = { get: jest.fn() };

  const service = new PaymentsService(
    paymentRepository as never,
    preOrderRepository as never,
    bePaidApiClient as never,
    paymentSettingsService as never,
    configService as never,
  );

  const applyGatewayTransaction = getApplyGatewayTransaction(service);

  const preOrderId = '019efb61-5d8e-7058-b838-6f2696cb4200';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets authorized on successful authorization webhook', async () => {
    const payment = {
      id: '019efb61-5d8e-7058-b838-6f2696cb4201',
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      preOrderId,
      status: PaymentStatus.PENDING,
      transactionType: 'authorization',
      trackingId: 'track-1',
      test: true,
    } as Payment;

    paymentRepository.findOne.mockResolvedValue(payment);

    await applyGatewayTransaction(
      {
        tracking_id: 'track-1',
        uid: 'uid-1',
        status: 'successful',
        type: 'authorization',
      },
      { restaurantId: payment.restaurantId, secretKey: 'sk' },
    );

    expect(payment.status).toBe(PaymentStatus.AUTHORIZED);
    expect(preOrderRepository.update).toHaveBeenCalledWith(
      { id: preOrderId },
      { paymentStatus: OrderPaymentStatus.AUTHORIZED },
    );
  });

  it('sets paid on successful payment webhook', async () => {
    const payment = {
      id: '019efb61-5d8e-7058-b838-6f2696cb4202',
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      preOrderId,
      status: PaymentStatus.PENDING,
      transactionType: 'payment',
      trackingId: 'track-2',
      test: true,
    } as Payment;

    paymentRepository.findOne.mockResolvedValue(payment);

    await applyGatewayTransaction(
      {
        tracking_id: 'track-2',
        uid: 'uid-2',
        status: 'successful',
        type: 'payment',
      },
      { restaurantId: payment.restaurantId, secretKey: 'sk' },
    );

    expect(payment.status).toBe(PaymentStatus.CAPTURED);
    expect(preOrderRepository.update).toHaveBeenCalledWith(
      { id: preOrderId },
      { paymentStatus: OrderPaymentStatus.PAID },
    );
  });
});
