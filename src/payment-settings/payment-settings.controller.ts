import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { UpdatePaymentSettingsDto } from './dto/payment-settings.dto';
import { PaymentSettingsService } from './payment-settings.service';

@Controller('restaurants/:restaurantId/payment-settings')
export class PaymentSettingsController {
  constructor(
    private readonly paymentSettingsService: PaymentSettingsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_PAYMENTS)
  getSettings(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.paymentSettingsService.getByRestaurant(restaurantId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_PAYMENTS)
  updateSettings(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: UpdatePaymentSettingsDto,
  ) {
    return this.paymentSettingsService.update(restaurantId, dto);
  }
}
