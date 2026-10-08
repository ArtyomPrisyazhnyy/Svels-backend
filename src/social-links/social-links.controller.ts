import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
} from './dto/social-link.dto';
import { SocialLinksService } from './social-links.service';

@Controller('restaurants/:restaurantId/social-links')
export class SocialLinksController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @Get()
  getLinks(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.socialLinksService.getByRestaurant(restaurantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MARKETING)
  create(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateSocialLinkDto,
  ) {
    return this.socialLinksService.create(restaurantId, dto);
  }

  @Patch(':linkId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MARKETING)
  update(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('linkId', ParseUuidV7Pipe) linkId: string,
    @Body() dto: UpdateSocialLinkDto,
  ) {
    return this.socialLinksService.update(restaurantId, linkId, dto);
  }

  @Delete(':linkId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MARKETING)
  remove(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('linkId', ParseUuidV7Pipe) linkId: string,
  ) {
    return this.socialLinksService.remove(restaurantId, linkId);
  }
}
