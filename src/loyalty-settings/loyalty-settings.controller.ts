import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { UpdateLoyaltySettingsDto } from './dto/loyalty-settings.dto';
import { LoyaltySettingsService } from './loyalty-settings.service';

@Controller('restaurants/:restaurantId/loyalty-settings')
export class LoyaltySettingsController {
  constructor(
    private readonly loyaltySettingsService: LoyaltySettingsService,
  ) {}

  @Get()
  getSettings(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.loyaltySettingsService.getByRestaurant(restaurantId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MARKETING)
  updateSettings(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: UpdateLoyaltySettingsDto,
  ) {
    return this.loyaltySettingsService.update(restaurantId, dto);
  }
}
