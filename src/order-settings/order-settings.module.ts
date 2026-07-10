import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RestaurantOrderSettings } from './entities/restaurant-order-settings.entity';
import { OrderSettingsController } from './order-settings.controller';
import { OrderSettingsService } from './order-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantOrderSettings])],
  controllers: [OrderSettingsController],
  providers: [OrderSettingsService, RestaurantAccessGuard],
  exports: [OrderSettingsService],
})
export class OrderSettingsModule {}
