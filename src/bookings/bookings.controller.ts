import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingStatusDto } from './dto/booking.dto';

@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_ADMIN)
  getRestaurantBookings(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.bookingsService.findByRestaurant(restaurantId);
  }

  @Patch('restaurants/:restaurantId/bookings/:bookingId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_ADMIN)
  updateStatus(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('bookingId', ParseUuidV7Pipe) bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(bookingId, restaurantId, dto);
  }
}
