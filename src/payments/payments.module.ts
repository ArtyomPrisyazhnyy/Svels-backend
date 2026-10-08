import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { PaymentSettingsModule } from '../payment-settings/payment-settings.module';
import { PreOrder } from '../pre-orders/entities/pre-order.entity';
import { BePaidApiClient } from './bepaid/bepaid-api.client';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PreOrder]), PaymentSettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, BePaidApiClient, RestaurantAccessGuard],
  exports: [PaymentsService, BePaidApiClient],
})
export class PaymentsModule {}
