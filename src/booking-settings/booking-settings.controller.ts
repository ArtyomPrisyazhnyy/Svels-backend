import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SetDepositDto, UpdateBookingSettingsDto } from './dto/booking-settings.dto';
import { BookingSettingsService } from './booking-settings.service';

@Controller('restaurants/:restaurantId/booking-settings')
export class BookingSettingsController {
  constructor(private readonly bookingSettingsService: BookingSettingsService) {}

  @Get()
  getSettings(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.bookingSettingsService.getByRestaurant(restaurantId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_BOOKING_SETTINGS)
  updateSettings(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: UpdateBookingSettingsDto,
  ) {
    return this.bookingSettingsService.update(restaurantId, dto);
  }

  /** Тонкий эндпоинт для панели депозитов конструктора планировки. */
  @Patch('deposit')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_BOOKING_SETTINGS)
  setDeposit(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: SetDepositDto,
  ) {
    return this.bookingSettingsService.setDeposit(restaurantId, dto);
  }
}
