import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateOrderSettingsDto } from './dto/order-settings.dto';
import { OrderSettingsService } from './order-settings.service';

@Controller('restaurants/:restaurantId/order-settings')
export class OrderSettingsController {
  constructor(private readonly orderSettingsService: OrderSettingsService) {}

  @Get()
  getSettings(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.orderSettingsService.getByRestaurant(restaurantId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  updateSettings(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: UpdateOrderSettingsDto,
  ) {
    return this.orderSettingsService.update(restaurantId, dto);
  }
}
