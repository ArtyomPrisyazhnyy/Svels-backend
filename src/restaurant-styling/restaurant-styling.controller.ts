import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateRestaurantStylingDto } from './dto/restaurant-styling.dto';
import { RestaurantStylingService } from './restaurant-styling.service';

@Controller('restaurants/:restaurantId/styling')
export class RestaurantStylingController {
  constructor(private readonly restaurantStylingService: RestaurantStylingService) {}

  @Get()
  getStyling(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.restaurantStylingService.getByRestaurant(restaurantId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_BRANDING)
  updateStyling(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: UpdateRestaurantStylingDto,
  ) {
    return this.restaurantStylingService.update(restaurantId, dto);
  }
}
