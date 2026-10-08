import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingStatusDto } from './dto/booking.dto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('restaurants/:restaurantId/bookings/availability')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  getAvailability(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Query('date') date: string,
  ) {
    if (!DATE_RE.test(date)) {
      return {
        enabled: false,
        mode: 'specific_table',
        slotMinutes: 30,
        bookingDurationMinutes: 120,
        date,
        slots: [],
      };
    }
    return this.bookingsService.getAvailability(restaurantId, date);
  }

  /**
   * Занятость столов на конкретный слот — для guest-виджета планировки.
   * Возвращает список { tableId, busyUntil } для столов, занятых в окне брони.
   */
  @Get('restaurants/:restaurantId/tables/availability')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  getTablesAvailability(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Query('date') date: string,
    @Query('time') time: string,
  ) {
    if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
      return { date, time, durationMinutes: 120, busy: [] };
    }
    return this.bookingsService.getTablesAvailability(restaurantId, date, time);
  }

  @Post('restaurants/:restaurantId/bookings')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(restaurantId, user.id, dto);
  }

  @Get('users/me/bookings')
  @UseGuards(JwtAuthGuard)
  getMyBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findByUser(user.id);
  }

  @Patch('users/me/bookings/:bookingId/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUuidV7Pipe) bookingId: string,
  ) {
    return this.bookingsService.cancel(bookingId, user.id);
  }

  @Get('restaurants/:restaurantId/bookings')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.VIEW_BOOKINGS)
  getRestaurantBookings(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
  ) {
    return this.bookingsService.findByRestaurant(restaurantId);
  }

  @Patch('restaurants/:restaurantId/bookings/:bookingId/status')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.VIEW_BOOKINGS)
  updateStatus(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('bookingId', ParseUuidV7Pipe) bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(bookingId, restaurantId, dto);
  }
}
