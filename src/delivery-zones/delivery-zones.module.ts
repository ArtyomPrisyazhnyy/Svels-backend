import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DELIVERY_PRICING_HOOK } from '../common/constants/injection-tokens';
import { RestaurantLocation } from '../restaurants/entities/restaurant-location.entity';
import { DeliveryPricingHookService } from './delivery-pricing-hook.service';
import { DeliveryZonesController } from './delivery-zones.controller';
import { DeliveryZonesService } from './delivery-zones.service';
import { DeliveryZone } from './entities/delivery-zone.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryZone, RestaurantLocation])],
  controllers: [DeliveryZonesController],
  providers: [
    DeliveryZonesService,
    DeliveryPricingHookService,
    {
      provide: DELIVERY_PRICING_HOOK,
      useExisting: DeliveryPricingHookService,
    },
  ],
  exports: [DeliveryZonesService, DELIVERY_PRICING_HOOK],
})
export class DeliveryZonesModule {}
