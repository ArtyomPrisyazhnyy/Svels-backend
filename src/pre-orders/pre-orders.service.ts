import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MENU_SERVICE } from '../common/constants/injection-tokens';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { sanitizeText } from '../common/utils/sanitize.util';
import type { MenuService } from '../menu/menu.service';
import type { PaymentResponseDto } from '../payments/dto/payment.dto';
import { PaymentsService } from '../payments/payments.service';
import {
  CreatePreOrderDto,
  PreOrderResponseDto,
} from './dto/pre-order.dto';
import { PreOrderItem } from './entities/pre-order-item.entity';
import { PreOrder } from './entities/pre-order.entity';

@Injectable()
export class PreOrdersService {
  constructor(
    @InjectRepository(PreOrder)
    private readonly preOrderRepository: Repository<PreOrder>,
    @InjectRepository(PreOrderItem)
    private readonly preOrderItemRepository: Repository<PreOrderItem>,
    @Inject(MENU_SERVICE)
    private readonly menuService: MenuService,
    private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
  ) {}

  async create(
    restaurantId: string,
    userId: string,
    dto: CreatePreOrderDto,
  ): Promise<PreOrderResponseDto> {
    const menu = await this.menuService.getMenuByRestaurant(restaurantId);
    const allItems = menu.categories.flatMap((c) => c.items);

    const order = await this.dataSource.transaction(async (manager) => {
      let totalAmount = 0;
      const orderItems: PreOrderItem[] = [];

      for (const item of dto.items) {
        const menuItem = allItems.find((m) => m.id === item.menuItemId);
        if (!menuItem || !menuItem.isAvailable) {
          throw new BadRequestException(
            `Позиция меню ${item.menuItemId} недоступна`,
          );
        }

        const unitPrice = Number(item.unitPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new BadRequestException('Некорректная цена позиции');
        }

        // Защита от явного занижения: не ниже базовой цены меню.
        if (unitPrice + 0.001 < Number(menuItem.price)) {
          throw new BadRequestException(
            `Цена «${menuItem.name}» ниже цены в меню`,
          );
        }

        totalAmount += unitPrice * item.quantity;
      }

      totalAmount = Math.round(totalAmount * 100) / 100;

      const preOrder = manager.create(PreOrder, {
        restaurantId,
        userId,
        bookingId: dto.bookingId ?? null,
        paymentMethod: dto.paymentMethod,
        totalAmount,
        status: PreOrderStatus.PENDING,
        comment: dto.comment?.trim() ? sanitizeText(dto.comment.trim()) : null,
      });

      const savedOrder = await manager.save(preOrder);

      for (const item of dto.items) {
        const menuItem = allItems.find((m) => m.id === item.menuItemId)!;
        const orderItem = manager.create(PreOrderItem, {
          preOrderId: savedOrder.id,
          menuItemId: item.menuItemId,
          name: item.name?.trim()
            ? sanitizeText(item.name.trim())
            : menuItem.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        });
        orderItems.push(await manager.save(orderItem));
      }

      return { ...savedOrder, items: orderItems };
    });

    let payment: PaymentResponseDto | null = null;
    let paymentRedirectUrl: string | null = null;

    if (dto.paymentMethod === PaymentMethod.ONLINE) {
      payment = await this.paymentsService.startOnlineCheckout({
        restaurantId,
        preOrderId: order.id,
        userId,
        amount: Number(order.totalAmount),
        description: `Предзаказ ${order.id.slice(0, 8)}`,
        customerFirstName: dto.customerName,
        customerPhone: dto.customerPhone,
      });
      paymentRedirectUrl = payment.redirectUrl;
    }

    return {
      id: order.id,
      restaurantId: order.restaurantId,
      userId: order.userId,
      bookingId: order.bookingId,
      status: order.status,
      paymentMethod: order.paymentMethod,
      totalAmount: Number(order.totalAmount),
      comment: order.comment,
      items: order.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
      payment,
      paymentRedirectUrl,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async findByUser(userId: string): Promise<PreOrder[]> {
    return this.preOrderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId: string): Promise<PreOrder & { items: PreOrderItem[] }> {
    const preOrder = await this.preOrderRepository.findOne({
      where: { id, userId },
    });

    if (!preOrder) {
      throw new NotFoundException('Предзаказ не найден');
    }

    const items = await this.preOrderItemRepository.find({
      where: { preOrderId: id },
    });

    return { ...preOrder, items };
  }
}
