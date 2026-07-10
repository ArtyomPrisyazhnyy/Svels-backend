import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { BOOKING_SETTINGS_SERVICE } from '../common/constants/injection-tokens';
import { RestaurantBookingSettings } from './entities/restaurant-booking-settings.entity';
import { BookingSettingsController } from './booking-settings.controller';
import { BookingSettingsService } from './booking-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantBookingSettings])],
  controllers: [BookingSettingsController],
  providers: [
    BookingSettingsService,
    RestaurantAccessGuard,
    { provide: BOOKING_SETTINGS_SERVICE, useExisting: BookingSettingsService },
  ],
  exports: [BOOKING_SETTINGS_SERVICE],
})
export class BookingSettingsModule {}
