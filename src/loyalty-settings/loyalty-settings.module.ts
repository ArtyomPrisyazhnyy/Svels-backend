import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RestaurantLoyaltySettings } from './entities/restaurant-loyalty-settings.entity';
import { LoyaltySettingsController } from './loyalty-settings.controller';
import { LoyaltySettingsService } from './loyalty-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantLoyaltySettings])],
  controllers: [LoyaltySettingsController],
  providers: [LoyaltySettingsService, RestaurantAccessGuard],
  exports: [LoyaltySettingsService],
})
export class LoyaltySettingsModule {}
