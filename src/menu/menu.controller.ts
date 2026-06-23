import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { generateUuidV7 } from '../common/utils/uuid.util';
import { CreateMenuCategoryDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto';
import { MenuService } from './menu.service';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('restaurants/:restaurantId/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  getMenu(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.menuService.getMenuByRestaurant(restaurantId);
  }

  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  async uploadImage(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Допустимы только JPG, PNG и WebP');
    }

    const buffer = await file.toBuffer();
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Размер файла не должен превышать 5 МБ');
    }

    const extension = extname(file.filename) || '.jpg';
    const fileName = `${generateUuidV7()}${extension}`;
    const directory = join(process.cwd(), 'uploads', 'menu', restaurantId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), buffer);

    return { imageUrl: `/uploads/menu/${restaurantId}/${fileName}` };
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  createCategory(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.menuService.createCategory(restaurantId, dto);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  createItem(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menuService.createItem(restaurantId, dto);
  }

  @Patch('items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  updateItem(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('itemId', ParseUuidV7Pipe) itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(restaurantId, itemId, dto);
  }

  @Delete('items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  deleteItem(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('itemId', ParseUuidV7Pipe) itemId: string,
  ) {
    return this.menuService.deleteItem(restaurantId, itemId);
  }
}
