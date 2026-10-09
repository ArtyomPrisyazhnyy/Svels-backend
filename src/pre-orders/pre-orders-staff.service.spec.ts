jest.mock('../payments/payments.service', () => ({
  PaymentsService: class PaymentsService {},
}));

import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderPaymentStatus } from '../common/enums/order-payment-status.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { PreOrdersStaffService } from './pre-orders-staff.service';

describe('PreOrdersStaffService', () => {
  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';
  const orderId = '019efb61-5d8e-7058-b838-6f2696cb4209';

  let preOrderRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let preOrderItemRepository: { find: jest.Mock };
  let paymentsService: {
    captureByPreOrder: jest.Mock;
    voidByPreOrder: jest.Mock;
  };
  let emitMock: jest.Mock;
  let service: PreOrdersStaffService;

  beforeEach(() => {
    preOrderRepository = {
      findOne: jest.fn(),
      save: jest.fn((o) => Promise.resolve(o)),
      createQueryBuilder: jest.fn(),
    };
    preOrderItemRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    paymentsService = {
      captureByPreOrder: jest.fn(),
      voidByPreOrder: jest.fn(),
    };
    emitMock = jest.fn();
    const eventEmitter = { emit: emitMock } as unknown as EventEmitter2;

    service = new PreOrdersStaffService(
      preOrderRepository as never,
      preOrderItemRepository as never,
      paymentsService as never,
      eventEmitter,
    );
  });

  function mockOrder(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    return {
      id: orderId,
      restaurantId,
      orderNumber: 7,
      status: PreOrderStatus.NEW,
      paymentStatus: OrderPaymentStatus.NOT_REQUIRED,
      statusChangedAt: now,
      createdAt: now,
      updatedAt: now,
      totalAmount: 10,
      paymentMethod: 'cash',
      fulfillmentType: 'delivery',
      customerName: 'A',
      customerPhone: '+375291234567',
      recipientName: null,
      recipientPhone: null,
      deliveryAddress: null,
      locationId: null,
      requestedAt: null,
      comment: null,
      cancelReason: null,
      bookingId: null,
      ...overrides,
    };
  }

  it('returns 403 when order belongs to another restaurant', async () => {
    preOrderRepository.findOne.mockResolvedValue({
      ...mockOrder(),
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4999',
    });

    await expect(service.getById(restaurantId, orderId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('captures on accepted when authorized', async () => {
    const order = mockOrder({
      status: PreOrderStatus.NEW,
      paymentStatus: OrderPaymentStatus.AUTHORIZED,
    });
    preOrderRepository.findOne
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({
        ...order,
        status: PreOrderStatus.ACCEPTED,
      });

    await service.changeStatus({
      restaurantId,
      orderId,
      to: PreOrderStatus.ACCEPTED,
      actor: { type: 'staff', userId: 'u1' },
      actorRole: UserRole.RESTAURANT_HALL,
    });

    expect(paymentsService.captureByPreOrder).toHaveBeenCalledWith(
      restaurantId,
      orderId,
    );
    expect(emitMock).toHaveBeenCalled();
  });

  it('rejects cancel for paid orders', async () => {
    preOrderRepository.findOne.mockResolvedValue(
      mockOrder({
        status: PreOrderStatus.ACCEPTED,
        paymentStatus: OrderPaymentStatus.PAID,
      }),
    );

    await expect(
      service.changeStatus({
        restaurantId,
        orderId,
        to: PreOrderStatus.CANCELLED,
        cancelReason: 'test',
        actor: { type: 'staff', userId: 'u1' },
        actorRole: UserRole.RESTAURANT_HALL,
      }),
    ).rejects.toMatchObject({
      response: { code: 'PAID_ORDER_CANCEL_NOT_SUPPORTED' },
    });
  });

  it('rejects invalid transition with INVALID_TRANSITION', async () => {
    preOrderRepository.findOne.mockResolvedValue(
      mockOrder({ status: PreOrderStatus.COMPLETED }),
    );

    await expect(
      service.changeStatus({
        restaurantId,
        orderId,
        to: PreOrderStatus.CANCELLED,
        cancelReason: 'late',
        actor: { type: 'staff', userId: 'u1' },
        actorRole: UserRole.RESTAURANT_HALL,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_TRANSITION' },
    });
  });
});
