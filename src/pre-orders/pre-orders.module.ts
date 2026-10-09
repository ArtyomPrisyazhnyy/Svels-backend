import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ORDERS_STAFF_SERVICE } from '../common/constants/injection-tokens';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { MenuModule } from '../menu/menu.module';
import { OrderSettingsModule } from '../order-settings/order-settings.module';
import { PaymentsModule } from '../payments/payments.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { RestaurantLocation } from '../restaurants/entities/restaurant-location.entity';
import { PreOrderItem } from './entities/pre-order-item.entity';
import { PreOrder } from './entities/pre-order.entity';
import { PreOrdersStaffService } from './pre-orders-staff.service';
import { PreOrdersController } from './pre-orders.controller';
import { PreOrdersService } from './pre-orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PreOrder, PreOrderItem, RestaurantLocation]),
    MenuModule,
    OrderSettingsModule,
    PaymentsModule,
    SchedulesModule,
  ],
  controllers: [PreOrdersController],
  providers: [
    PreOrdersService,
    PreOrdersStaffService,
    RestaurantAccessGuard,
    {
      provide: ORDERS_STAFF_SERVICE,
      useExisting: PreOrdersStaffService,
    },
  ],
  exports: [PreOrdersService, ORDERS_STAFF_SERVICE],
})
export class PreOrdersModule {}
