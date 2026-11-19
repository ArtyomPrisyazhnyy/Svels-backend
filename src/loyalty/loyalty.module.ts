import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LOYALTY_ORDER_PRICING } from '../common/constants/injection-tokens';
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
    { provide: LOYALTY_ORDER_PRICING, useExisting: LoyaltyService },
  ],
  exports: [LOYALTY_ORDER_PRICING],
})
export class LoyaltyModule {}
