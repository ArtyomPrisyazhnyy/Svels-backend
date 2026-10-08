import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MENU_SERVICE } from '../common/constants/injection-tokens';
import { FulfillmentType } from '../common/enums/fulfillment-type.enum';
import { OrderPaymentStatus } from '../common/enums/order-payment-status.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { normalizePhone } from '../common/utils/normalize-phone.util';
import { sanitizeText } from '../common/utils/sanitize.util';
import type { MenuService } from '../menu/menu.service';
import { OrderSettingsService } from '../order-settings/order-settings.service';
import type { PaymentResponseDto } from '../payments/dto/payment.dto';
import { PaymentsService } from '../payments/payments.service';
import { RestaurantLocation } from '../restaurants/entities/restaurant-location.entity';
import {
  CreatePreOrderDto,
  DeliveryAddressDto,
  OrderDto,
  PreOrderResponseDto,
} from './dto/pre-order.dto';
import {
  ORDER_CREATED_EVENT,
  OrderCreatedEvent,
} from './events/order-created.event';
import { PreOrderItem } from './entities/pre-order-item.entity';
import { PreOrder } from './entities/pre-order.entity';
import {
  mapPreOrderToOrderDto,
  mapPreOrderToResponseDto,
} from './pre-order.mapper';
import {
  MenuItemPricingError,
  resolveMenuItemLine,
} from './utils/menu-item-pricing.util';
import { throwOrderBusinessError } from './utils/order-business-error.util';

const MAX_ORDER_NUMBER_RETRIES = 5;
const MY_ORDERS_LIMIT = 50;

@Injectable()
export class PreOrdersService {
  constructor(
    @InjectRepository(PreOrder)
    private readonly preOrderRepository: Repository<PreOrder>,
    @InjectRepository(PreOrderItem)
    private readonly preOrderItemRepository: Repository<PreOrderItem>,
    @InjectRepository(RestaurantLocation)
    private readonly locationRepository: Repository<RestaurantLocation>,
    @Inject(MENU_SERVICE)
    private readonly menuService: MenuService,
    private readonly orderSettingsService: OrderSettingsService,
    private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    restaurantId: string,
    userId: string,
    dto: CreatePreOrderDto,
  ): Promise<PreOrderResponseDto> {
    const settings =
      await this.orderSettingsService.getByRestaurant(restaurantId);

    if (settings.ordersPaused) {
      throwOrderBusinessError(
        'ORDERS_PAUSED',
        'Заведение сейчас не принимает заказы',
      );
    }

    this.assertFulfillmentEnabled(dto.fulfillmentType, settings);
    this.assertPaymentMethodEnabled(dto.paymentMethod, settings);

    let customerPhone: string;
    try {
      customerPhone = normalizePhone(dto.customerPhone);
    } catch {
      throwOrderBusinessError('VALIDATION', 'Некорректный телефон гостя');
    }

    let recipientPhone: string | null = null;
    if (dto.recipientPhone?.trim()) {
      try {
        recipientPhone = normalizePhone(dto.recipientPhone);
      } catch {
        throwOrderBusinessError(
          'VALIDATION',
          'Некорректный телефон получателя',
        );
      }
    }

    const deliveryAddress = this.normalizeDeliveryAddress(dto);
    if (dto.fulfillmentType === FulfillmentType.DELIVERY && !deliveryAddress) {
      throwOrderBusinessError('ADDRESS_REQUIRED', 'Укажите адрес доставки');
    }

    const locationId = await this.resolveLocationId(
      restaurantId,
      dto.fulfillmentType,
      dto.locationId,
    );

    const allowRecipient =
      dto.fulfillmentType === FulfillmentType.DELIVERY &&
      settings.deliveryForSomeoneElse;
    if (!allowRecipient && (dto.recipientName || dto.recipientPhone)) {
      throwOrderBusinessError(
        'VALIDATION',
        'Получатель доступен только для доставки «для другого человека»',
      );
    }

    const requestedAt = this.parseRequestedAt(dto.requestedAt);

    const menu = await this.menuService.getMenuByRestaurant(restaurantId);
    const menuItemsById = new Map(
      menu.categories.flatMap((c) => c.items).map((item) => [item.id, item]),
    );

    const pricedLines = dto.items.map((item) => {
      try {
        return {
          ...item,
          ...resolveMenuItemLine(
            menuItemsById.get(item.menuItemId),
            item.modifierSelections,
          ),
        };
      } catch (error) {
        if (error instanceof MenuItemPricingError) {
          throwOrderBusinessError(
            error.code,
            error.code === 'ITEM_UNAVAILABLE'
              ? 'Позиция меню недоступна'
              : 'Некорректные модификаторы',
          );
        }
        throw error;
      }
    });

    let totalAmount = 0;
    for (const line of pricedLines) {
      totalAmount += line.unitPrice * line.quantity;
    }
    totalAmount = Math.round(totalAmount * 100) / 100;

    const paymentStatus =
      dto.paymentMethod === PaymentMethod.ONLINE
        ? OrderPaymentStatus.PENDING
        : OrderPaymentStatus.NOT_REQUIRED;

    const now = new Date();
    const order = await this.saveOrderWithRetry({
      restaurantId,
      userId,
      dto,
      customerPhone,
      recipientPhone,
      deliveryAddress,
      locationId,
      requestedAt,
      totalAmount,
      paymentStatus,
      pricedLines,
      now,
    });

    let payment: PaymentResponseDto | null = null;
    let paymentRedirectUrl: string | null = null;

    if (dto.paymentMethod === PaymentMethod.ONLINE) {
      payment = await this.paymentsService.startOnlineCheckout({
        restaurantId,
        preOrderId: order.id,
        userId,
        amount: Number(order.totalAmount),
        description: `Заказ №${order.orderNumber}`,
        customerFirstName: dto.customerName,
        customerPhone,
      });
      paymentRedirectUrl = payment.redirectUrl;
    }

    this.eventEmitter.emit(
      ORDER_CREATED_EVENT,
      new OrderCreatedEvent(order.id, restaurantId, order.orderNumber),
    );

    const items = await this.preOrderItemRepository.find({
      where: { preOrderId: order.id },
    });

    return mapPreOrderToResponseDto(order, items, payment, paymentRedirectUrl);
  }

  async findByUser(userId: string): Promise<OrderDto[]> {
    const orders = await this.preOrderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: MY_ORDERS_LIMIT,
    });

    if (!orders.length) {
      return [];
    }

    const orderIds = orders.map((o) => o.id);
    const items = await this.preOrderItemRepository
      .createQueryBuilder('item')
      .where('item.preOrderId IN (:...orderIds)', { orderIds })
      .getMany();

    const itemsByOrder = new Map<string, PreOrderItem[]>();
    for (const item of items) {
      const list = itemsByOrder.get(item.preOrderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.preOrderId, list);
    }

    return orders.map((order) =>
      mapPreOrderToOrderDto(order, itemsByOrder.get(order.id) ?? []),
    );
  }

  async findById(id: string, userId: string): Promise<OrderDto> {
    const preOrder = await this.preOrderRepository.findOne({
      where: { id, userId },
    });

    if (!preOrder) {
      throw new NotFoundException('Предзаказ не найден');
    }

    const items = await this.preOrderItemRepository.find({
      where: { preOrderId: id },
    });

    return mapPreOrderToOrderDto(preOrder, items);
  }

  private assertFulfillmentEnabled(
    fulfillmentType: FulfillmentType,
    settings: Awaited<ReturnType<OrderSettingsService['getByRestaurant']>>,
  ): void {
    const map: Record<FulfillmentType, boolean> = {
      [FulfillmentType.DELIVERY]: settings.fulfillmentDelivery,
      [FulfillmentType.TAKEAWAY]: settings.fulfillmentTakeaway,
      [FulfillmentType.DINE_IN]: settings.fulfillmentDineIn,
    };
    if (!map[fulfillmentType]) {
      throwOrderBusinessError(
        'FULFILLMENT_DISABLED',
        'Способ получения заказа отключён',
      );
    }
  }

  private assertPaymentMethodEnabled(
    paymentMethod: PaymentMethod,
    settings: Awaited<ReturnType<OrderSettingsService['getByRestaurant']>>,
  ): void {
    const map: Record<PaymentMethod, boolean> = {
      [PaymentMethod.CASH]: settings.paymentCash,
      [PaymentMethod.CARD]: settings.paymentCardOnSite,
      [PaymentMethod.ONLINE]: settings.paymentOnline,
    };
    if (!map[paymentMethod]) {
      throwOrderBusinessError(
        'PAYMENT_METHOD_DISABLED',
        'Способ оплаты отключён',
      );
    }
  }

  private normalizeDeliveryAddress(
    dto: CreatePreOrderDto,
  ): DeliveryAddressDto | null {
    if (dto.fulfillmentType !== FulfillmentType.DELIVERY) {
      return null;
    }
    if (!dto.deliveryAddress) {
      return null;
    }
    const addr = dto.deliveryAddress;
    return {
      street: sanitizeText(addr.street.trim()),
      house: sanitizeText(addr.house.trim()),
      apartment: addr.apartment?.trim()
        ? sanitizeText(addr.apartment.trim())
        : undefined,
      entrance: addr.entrance?.trim()
        ? sanitizeText(addr.entrance.trim())
        : undefined,
      floor: addr.floor?.trim() ? sanitizeText(addr.floor.trim()) : undefined,
      intercom: addr.intercom?.trim()
        ? sanitizeText(addr.intercom.trim())
        : undefined,
      comment: addr.comment?.trim()
        ? sanitizeText(addr.comment.trim())
        : undefined,
    };
  }

  private async resolveLocationId(
    restaurantId: string,
    fulfillmentType: FulfillmentType,
    locationId?: string,
  ): Promise<string | null> {
    if (fulfillmentType === FulfillmentType.DELIVERY) {
      return null;
    }

    const locations = await this.locationRepository.find({
      where: { restaurantId },
      order: { sortOrder: 'ASC' },
    });

    if (locations.length <= 1) {
      return locations[0]?.id ?? null;
    }

    if (!locationId) {
      throwOrderBusinessError('LOCATION_REQUIRED', 'Выберите точку заведения');
    }

    const exists = locations.some((l) => l.id === locationId);
    if (!exists) {
      throwOrderBusinessError('LOCATION_REQUIRED', 'Выберите точку заведения');
    }

    return locationId;
  }

  private parseRequestedAt(value: string | null | undefined): Date | null {
    if (value === undefined || value === null) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throwOrderBusinessError(
        'INVALID_REQUESTED_AT',
        'Некорректное время заказа',
      );
    }
    const now = Date.now();
    const min = now + 10 * 60 * 1000;
    const max = now + 7 * 24 * 60 * 60 * 1000;
    const ts = date.getTime();
    if (ts < min || ts > max) {
      throwOrderBusinessError(
        'INVALID_REQUESTED_AT',
        'Время заказа вне допустимого диапазона',
      );
    }
    return date;
  }

  private async saveOrderWithRetry(params: {
    restaurantId: string;
    userId: string;
    dto: CreatePreOrderDto;
    customerPhone: string;
    recipientPhone: string | null;
    deliveryAddress: DeliveryAddressDto | null;
    locationId: string | null;
    requestedAt: Date | null;
    totalAmount: number;
    paymentStatus: OrderPaymentStatus;
    pricedLines: Array<{
      menuItemId: string;
      quantity: number;
      unitPrice: number;
      name: string;
      modifiers: PreOrderItem['modifiers'];
    }>;
    now: Date;
  }): Promise<PreOrder> {
    for (let attempt = 0; attempt < MAX_ORDER_NUMBER_RETRIES; attempt += 1) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const rows: Array<{ next: string | number }> = await manager.query(
            `SELECT COALESCE(MAX("orderNumber"), 0) + 1 AS "next" FROM pre_orders WHERE "restaurantId" = $1`,
            [params.restaurantId],
          );
          const orderNumber = Number(rows[0]?.next ?? 1);

          const preOrder = manager.create(PreOrder, {
            restaurantId: params.restaurantId,
            userId: params.userId,
            orderNumber,
            bookingId: params.dto.bookingId ?? null,
            paymentMethod: params.dto.paymentMethod,
            fulfillmentType: params.dto.fulfillmentType,
            paymentStatus: params.paymentStatus,
            customerName: sanitizeText(params.dto.customerName.trim()),
            customerPhone: params.customerPhone,
            recipientName: params.dto.recipientName?.trim()
              ? sanitizeText(params.dto.recipientName.trim())
              : null,
            recipientPhone: params.recipientPhone,
            deliveryAddress: params.deliveryAddress,
            locationId: params.locationId,
            requestedAt: params.requestedAt,
            totalAmount: params.totalAmount,
            status: PreOrderStatus.NEW,
            statusChangedAt: params.now,
            comment: params.dto.comment?.trim()
              ? sanitizeText(params.dto.comment.trim())
              : null,
            cancelReason: null,
          });

          const savedOrder = await manager.save(preOrder);

          for (const line of params.pricedLines) {
            const orderItem = manager.create(PreOrderItem, {
              preOrderId: savedOrder.id,
              menuItemId: line.menuItemId,
              name: line.name,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              modifiers: line.modifiers,
            });
            await manager.save(orderItem);
          }

          return savedOrder;
        });
      } catch (error) {
        const code =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          typeof (error as { code: unknown }).code === 'string'
            ? (error as { code: string }).code
            : '';
        if (code === '23505' && attempt < MAX_ORDER_NUMBER_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }

    throwOrderBusinessError(
      'ORDERS_PAUSED',
      'Не удалось создать заказ, попробуйте снова',
    );
  }
}
