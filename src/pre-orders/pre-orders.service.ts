import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MENU_SERVICE } from '../common/constants/injection-tokens';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { MenuService } from '../menu/menu.service';
import { CreatePreOrderDto } from './dto/pre-order.dto';
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
  ) {}

  async create(
    restaurantId: string,
    userId: string,
    dto: CreatePreOrderDto,
  ): Promise<PreOrder & { items: PreOrderItem[] }> {
    const menu = await this.menuService.getMenuByRestaurant(restaurantId);
    const allItems = menu.categories.flatMap((c) => c.items);

    return this.dataSource.transaction(async (manager) => {
      let totalAmount = 0;
      const orderItems: PreOrderItem[] = [];

      for (const item of dto.items) {
        const menuItem = allItems.find((m) => m.id === item.menuItemId);
        if (!menuItem || !menuItem.isAvailable) {
          throw new BadRequestException(
            `Позиция меню ${item.menuItemId} недоступна`,
          );
        }

        const lineTotal = Number(menuItem.price) * item.quantity;
        totalAmount += lineTotal;
      }

      const preOrder = manager.create(PreOrder, {
        restaurantId,
        userId,
        bookingId: dto.bookingId ?? null,
        paymentMethod: dto.paymentMethod,
        totalAmount,
        status: PreOrderStatus.PENDING,
      });

      const savedOrder = await manager.save(preOrder);

      for (const item of dto.items) {
        const menuItem = allItems.find((m) => m.id === item.menuItemId)!;
        const orderItem = manager.create(PreOrderItem, {
          preOrderId: savedOrder.id,
          menuItemId: item.menuItemId,
          name: menuItem.name,
          quantity: item.quantity,
          unitPrice: Number(menuItem.price),
        });
        orderItems.push(await manager.save(orderItem));
      }

      return { ...savedOrder, items: orderItems };
    });
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
