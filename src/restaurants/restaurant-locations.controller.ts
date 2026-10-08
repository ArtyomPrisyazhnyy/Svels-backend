import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateRestaurantLocationDto,
  GeocodeQueryDto,
  UpdateRestaurantLocationDto,
} from './dto/restaurant-location.dto';
import { RestaurantLocationsService } from './restaurant-locations.service';

@Controller('restaurants/:restaurantId/locations')
export class RestaurantLocationsController {
  constructor(private readonly locationsService: RestaurantLocationsService) {}

  @Get()
  getLocations(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.locationsService.getByRestaurant(restaurantId);
  }

  @Get('geocode')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_RESTAURANT)
  geocode(
    @Param('restaurantId', ParseUuidV7Pipe) _restaurantId: string,
    @Query() query: GeocodeQueryDto,
  ) {
    return this.locationsService.geocode(query.q);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_RESTAURANT)
  create(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateRestaurantLocationDto,
  ) {
    return this.locationsService.create(restaurantId, dto);
  }

  @Patch(':locationId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_RESTAURANT)
  update(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('locationId', ParseUuidV7Pipe) locationId: string,
    @Body() dto: UpdateRestaurantLocationDto,
  ) {
    return this.locationsService.update(restaurantId, locationId, dto);
  }

  @Delete(':locationId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_RESTAURANT)
  remove(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('locationId', ParseUuidV7Pipe) locationId: string,
  ) {
    return this.locationsService.remove(restaurantId, locationId);
  }
}
