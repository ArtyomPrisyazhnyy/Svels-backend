import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  HttpCode,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MediaUploadService } from '../media/media-upload.service';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';
import {
  ReorderMenuCategoriesDto,
  UpdateMenuCategoryDto,
} from './dto/menu-category.dto';
import { MenuService } from './menu.service';

@Controller('restaurants/:restaurantId/menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly mediaUploadService: MediaUploadService,
  ) {}

  @Get()
  getMenu(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.menuService.getMenuByRestaurant(restaurantId);
  }

  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MENU)
  async uploadImage(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const buffer = await file.toBuffer();
    const uploaded = await this.mediaUploadService.uploadMenuImage(
      restaurantId,
      buffer,
      file.mimetype,
    );

    return {
      imageUrl: uploaded.url,
      imageWebpUrl: uploaded.webpUrl,
    };
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MENU)
  createCategory(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.menuService.createCategory(restaurantId, dto);
  }

  @Patch('categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MENU)
  updateCategory(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('categoryId', ParseUuidV7Pipe) categoryId: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.menuService.updateCategory(restaurantId, categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MENU)
  deleteCategory(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('categoryId', ParseUuidV7Pipe) categoryId: string,
  ) {
    return this.menuService.deleteCategory(restaurantId, categoryId);
  }

  @Put('categories/order')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MENU)
  reorderCategories(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: ReorderMenuCategoriesDto,
  ) {
    return this.menuService.reorderCategories(restaurantId, dto);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MENU)
  createItem(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menuService.createItem(restaurantId, dto);
  }

  @Patch('items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MENU)
  updateItem(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('itemId', ParseUuidV7Pipe) itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(restaurantId, itemId, dto);
  }

  @Delete('items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_MENU)
  deleteItem(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('itemId', ParseUuidV7Pipe) itemId: string,
  ) {
    return this.menuService.deleteItem(restaurantId, itemId);
  }
}
