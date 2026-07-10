import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
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
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  updateSettings(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: UpdateBookingSettingsDto,
  ) {
    return this.bookingSettingsService.update(restaurantId, dto);
  }

  /** Тонкий эндпоинт для панели депозитов конструктора планировки. */
  @Patch('deposit')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  setDeposit(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: SetDepositDto,
  ) {
    return this.bookingSettingsService.setDeposit(restaurantId, dto);
  }
}
