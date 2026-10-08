import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RestaurantPaymentSettings } from './entities/restaurant-payment-settings.entity';
import { PaymentSettingsController } from './payment-settings.controller';
import { PaymentSettingsService } from './payment-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantPaymentSettings])],
  controllers: [PaymentSettingsController],
  providers: [PaymentSettingsService, RestaurantAccessGuard],
  exports: [PaymentSettingsService],
})
export class PaymentSettingsModule {}
