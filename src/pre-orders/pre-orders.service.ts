import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { USERS_SERVICE } from '../common/constants/injection-tokens';
import type { IUsersService } from '../users/interfaces/users-service.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  GUEST_ADDRESS_LOOKUP,
  LOYALTY_ORDER_PRICING,
  MENU_SERVICE,
} from '../common/constants/injection-tokens';
import { FulfillmentType } from '../common/enums/fulfillment-type.enum';
import { OrderPaymentStatus } from '../common/enums/order-payment-status.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { normalizePhone } from '../common/utils/normalize-phone.util';
import { sanitizeText } from '../common/utils/sanitize.util';
import type { ILoyaltyOrderPricing } from '../loyalty/interfaces/loyalty-order-pricing.interface';
import type { MenuService } from '../menu/menu.service';
import { OrderSettingsService } from '../order-settings/order-settings.service';
import type { PaymentResponseDto } from '../payments/dto/payment.dto';
import { PaymentsService } from '../payments/payments.service';
import { RestaurantLocation } from '../restaurants/entities/restaurant-location.entity';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import { QuotePreOrderDto } from './dto/quote-pre-order.dto';
import {
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
  fulfillmentInstant,
  parseRequestedAt,
} from './pricing/requested-at.util';
import { isRestaurantOpenAt } from './pricing/minsk-time.util';
import {
  priceCart,
  type CartQuote,
  type CartQuoteResponse,
} from './pricing/cart-quote.util';
import { MenuItemPricingError } from './pricing/menu-item-line.util';
import { throwOrderNumberConflict } from './staff/pre-order-conflict.util';
import { throwOrderBusinessError } from './utils/order-business-error.util';
import { SchedulesService } from '../schedules/schedules.service';
import type { GuestAddressLookup } from './interfaces/guest-address-lookup.interface';

const MAX_ORDER_NUMBER_RETRIES = 5;
const MY_ORDERS_LIMIT = 50;

@Injectable()
export class PreOrdersService {
  private readonly logger = new Logger(PreOrdersService.name);

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
    private readonly schedulesService: SchedulesService,
    @Inject(GUEST_ADDRESS_LOOKUP)
    private readonly guestAddressLookup: GuestAddressLookup,
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
    @Inject(LOYALTY_ORDER_PRICING)
    private readonly loyaltyOrderPricing: ILoyaltyOrderPricing,
  ) {}

  async quote(
    restaurantId: string,
    userId: string | null,
    dto: QuotePreOrderDto,
  ): Promise<CartQuoteResponse> {
    const quote = await this.priceForRestaurant(
      restaurantId,
      userId,
      dto.items,
    );
    return {
      lines: quote.lines,
      subtotal: quote.subtotal,
      loyaltyDiscount: quote.loyaltyDiscount,
      giftRewards: quote.giftRewards,
      total: quote.total,
    };
  }

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

    const customerPhone = await this.resolveCustomerPhone(
      userId,
      dto.customerPhone,
    );

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

    const now = new Date();
    const deliveryAddress = await this.resolveDeliveryAddress(
      restaurantId,
      userId,
      dto,
    );
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

    const requestedAt = parseRequestedAt(dto.requestedAt);

    const schedules = await this.schedulesService.getByRestaurant(restaurantId);
    const fulfillmentTime = fulfillmentInstant(requestedAt);
    if (!isRestaurantOpenAt(schedules, fulfillmentTime)) {
      throwOrderBusinessError(
        'RESTAURANT_CLOSED',
        'Заведение сейчас не принимает заказы',
      );
    }

    const quote = await this.priceForRestaurant(
      restaurantId,
      userId,
      dto.items,
    );

    const payableOnline =
      dto.paymentMethod === PaymentMethod.ONLINE && quote.total > 0;
    const paymentStatus = payableOnline
      ? OrderPaymentStatus.PENDING
      : OrderPaymentStatus.NOT_REQUIRED;

    const order = await this.saveOrderWithRetry({
      restaurantId,
      userId,
      dto,
      customerPhone,
      recipientPhone,
      deliveryAddress,
      locationId,
      requestedAt,
      quote,
      paymentStatus,
      now,
    });

    let payment: PaymentResponseDto | null = null;
    let paymentRedirectUrl: string | null = null;

    if (payableOnline) {
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

    if (dto.fulfillmentType === FulfillmentType.DELIVERY) {
      try {
        if (dto.addressId) {
          await this.guestAddressLookup.touchLastUsedAt(
            userId,
            restaurantId,
            dto.addressId,
            now,
          );
        } else if (dto.saveAddress === true && deliveryAddress) {
          await this.guestAddressLookup.touchOrSave({
            userId,
            restaurantId,
            snapshot: deliveryAddress,
            label: dto.addressLabel,
            now,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Не удалось обновить сохранённый адрес гостя (orderId=${order.id}): ${message}`,
        );
      }
    }

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

  private async resolveDeliveryAddress(
    restaurantId: string,
    userId: string,
    dto: CreatePreOrderDto,
  ): Promise<DeliveryAddressDto | null> {
    if (dto.fulfillmentType !== FulfillmentType.DELIVERY) {
      return null;
    }

    if (dto.addressId) {
      const snapshot = await this.guestAddressLookup.findSnapshotForOrder(
        userId,
        restaurantId,
        dto.addressId,
      );
      if (!snapshot) {
        throwOrderBusinessError('ADDRESS_NOT_FOUND', 'Адрес не найден');
      }
      return snapshot;
    }

    return this.normalizeDeliveryAddress(dto);
  }

  private normalizeDeliveryAddress(
    dto: CreatePreOrderDto,
  ): DeliveryAddressDto | null {
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

  private async saveOrderWithRetry(params: {
    restaurantId: string;
    userId: string;
    dto: CreatePreOrderDto;
    customerPhone: string;
    recipientPhone: string | null;
    deliveryAddress: DeliveryAddressDto | null;
    locationId: string | null;
    requestedAt: Date | null;
    quote: CartQuote;
    paymentStatus: OrderPaymentStatus;
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
            subtotalAmount: params.quote.subtotal,
            loyaltyDiscountAmount: params.quote.loyaltyDiscount?.amount ?? 0,
            loyaltyLevelId: params.quote.loyaltyLevelId,
            loyaltyLevelName: params.quote.loyaltyLevelName,
            loyaltyRewardSnapshot: params.quote.loyaltyRewardSnapshot,
            totalAmount: params.quote.total,
            status: PreOrderStatus.NEW,
            statusChangedAt: params.now,
            comment: params.dto.comment?.trim()
              ? sanitizeText(params.dto.comment.trim())
              : null,
            cancelReason: null,
          });

          const savedOrder = await manager.save(preOrder);

          for (const line of params.quote.lines) {
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
        const code = postgresErrorCode(error);
        if (code === '23505' && attempt < MAX_ORDER_NUMBER_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }

    throwOrderNumberConflict();
  }

  private async resolveCustomerPhone(
    userId: string,
    rawPhone?: string,
  ): Promise<string> {
    const trimmed = rawPhone?.trim();
    if (trimmed) {
      try {
        return normalizePhone(trimmed);
      } catch {
        throwOrderBusinessError('VALIDATION', 'Некорректный телефон гостя');
      }
    }

    const user = await this.usersService.findById(userId);
    if (user?.phone) {
      try {
        return normalizePhone(user.phone);
      } catch {
        throwOrderBusinessError('VALIDATION', 'Некорректный телефон гостя');
      }
    }

    throwOrderBusinessError(
      'PHONE_REQUIRED',
      'Укажите номер телефона для оформления заказа',
    );
  }

  private async priceForRestaurant(
    restaurantId: string,
    userId: string | null,
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifierSelections?: Record<string, string[]>;
    }>,
  ): Promise<CartQuote> {
    const menu = await this.menuService.getMenuByRestaurant(restaurantId);
    const menuItemsById = new Map(
      menu.categories
        .flatMap((category) => category.items)
        .map((item) => [item.id, item]),
    );
    const loyalty = userId
      ? await this.loyaltyOrderPricing.loadForCart(restaurantId, userId)
      : null;

    try {
      return priceCart({
        userId,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          modifierSelections: item.modifierSelections,
        })),
        menuItemsById,
        loyalty,
        now: new Date(),
      });
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
  }
}

function postgresErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return '';
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}
