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
  CreateDeliveryZoneDto,
  DeliveryQuoteQueryDto,
  UpdateDeliveryZoneDto,
} from './dto/delivery-zone.dto';
import { DeliveryZonesService } from './delivery-zones.service';

@Controller('restaurants/:restaurantId')
export class DeliveryZonesController {
  constructor(private readonly deliveryZonesService: DeliveryZonesService) {}

  @Get('delivery-quote')
  quote(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Query() query: DeliveryQuoteQueryDto,
  ) {
    return this.deliveryZonesService.quote(
      restaurantId,
      { lat: query.lat, lng: query.lng },
      query.locationId,
      query.subtotal ?? 0,
    );
  }

  @Get('locations/:locationId/delivery-zones')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_ORDER_SETTINGS)
  list(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('locationId', ParseUuidV7Pipe) locationId: string,
  ) {
    return this.deliveryZonesService.listByLocation(restaurantId, locationId);
  }

  @Post('locations/:locationId/delivery-zones')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_ORDER_SETTINGS)
  create(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('locationId', ParseUuidV7Pipe) locationId: string,
    @Body() dto: CreateDeliveryZoneDto,
  ) {
    return this.deliveryZonesService.create(restaurantId, locationId, dto);
  }

  @Patch('locations/:locationId/delivery-zones/:zoneId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_ORDER_SETTINGS)
  update(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('locationId', ParseUuidV7Pipe) locationId: string,
    @Param('zoneId', ParseUuidV7Pipe) zoneId: string,
    @Body() dto: UpdateDeliveryZoneDto,
  ) {
    return this.deliveryZonesService.update(
      restaurantId,
      locationId,
      zoneId,
      dto,
    );
  }

  @Delete('locations/:locationId/delivery-zones/:zoneId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_ORDER_SETTINGS)
  remove(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('locationId', ParseUuidV7Pipe) locationId: string,
    @Param('zoneId', ParseUuidV7Pipe) zoneId: string,
  ) {
    return this.deliveryZonesService.remove(restaurantId, locationId, zoneId);
  }
}
