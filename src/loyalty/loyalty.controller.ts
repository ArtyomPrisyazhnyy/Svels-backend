import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import type { LoyaltyBalanceResponseDto } from './dto/loyalty-balance.dto';
import { LoyaltyService } from './loyalty.service';

@Controller('restaurants/:restaurantId/loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyBalance(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LoyaltyBalanceResponseDto> {
    return this.loyaltyService.getBalance(restaurantId, user.id);
  }

  @Get('guests/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.VIEW_ORDERS)
  getGuestBalance(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('userId', ParseUuidV7Pipe) userId: string,
  ): Promise<LoyaltyBalanceResponseDto> {
    return this.loyaltyService.getBalance(restaurantId, userId);
  }
}
