import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { LoyaltySettingsModule } from '../loyalty-settings/loyalty-settings.module';
import { GuestLoyaltyBalance } from './entities/guest-loyalty-balance.entity';
import { LoyaltyVisit } from './entities/loyalty-visit.entity';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyOrderEventsListener } from './loyalty-order-events.listener';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoyaltyVisit, GuestLoyaltyBalance]),
    LoyaltySettingsModule,
  ],
  controllers: [LoyaltyController],
  providers: [
    LoyaltyService,
    LoyaltyOrderEventsListener,
    RestaurantAccessGuard,
  ],
})
export class LoyaltyModule {}
