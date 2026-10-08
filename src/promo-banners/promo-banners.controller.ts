import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { MediaUploadService } from '../media/media-upload.service';
import { CreatePromoBannerDto, UpdatePromoBannerDto } from './dto/promo-banner.dto';
import { PromoBannersService } from './promo-banners.service';

@Controller('restaurants/:restaurantId/promo-banners')
export class PromoBannersController {
  constructor(
    private readonly promoBannersService: PromoBannersService,
    private readonly mediaUploadService: MediaUploadService,
  ) {}

  /** Все баннеры (админка). */
  @Get()
  getBanners(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.promoBannersService.getByRestaurant(restaurantId);
  }

  /** Только активные — для публичной страницы. */
  @Get('active')
  getActiveBanners(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.promoBannersService.getActiveByRestaurant(restaurantId);
  }

  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MARKETING)
  async uploadImage(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const buffer = await file.toBuffer();
    const uploaded = await this.mediaUploadService.uploadBanner(
      restaurantId,
      buffer,
      file.mimetype,
    );

    return {
      imageUrl: uploaded.url,
      imageWebpUrl: uploaded.webpUrl,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MARKETING)
  create(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreatePromoBannerDto,
  ) {
    return this.promoBannersService.create(restaurantId, dto);
  }

  @Patch(':bannerId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MARKETING)
  update(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('bannerId', ParseUuidV7Pipe) bannerId: string,
    @Body() dto: UpdatePromoBannerDto,
  ) {
    return this.promoBannersService.update(restaurantId, bannerId, dto);
  }

  @Delete(':bannerId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MARKETING)
  remove(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('bannerId', ParseUuidV7Pipe) bannerId: string,
  ) {
    return this.promoBannersService.remove(restaurantId, bannerId);
  }
}
