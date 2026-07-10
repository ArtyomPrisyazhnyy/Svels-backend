import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingSettingsModule } from '../booking-settings/booking-settings.module';
import { FloorPlansModule } from '../floor-plans/floor-plans.module';
import { RestaurantBookingSettings } from '../booking-settings/entities/restaurant-booking-settings.entity';
import { SchedulesModule } from '../schedules/schedules.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, RestaurantBookingSettings]),
    FloorPlansModule,
    BookingSettingsModule,
    SchedulesModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
