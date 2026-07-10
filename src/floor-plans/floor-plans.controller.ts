import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateFloorPlanDto,
  CreateTableDto,
  SaveLayoutDto,
  UpdateFloorPlanDto,
  UpdateTableDto,
} from './dto/floor-plan.dto';
import { FloorPlansService } from './floor-plans.service';

@Controller('restaurants/:restaurantId/floor-plans')
export class FloorPlansController {
  constructor(private readonly floorPlansService: FloorPlansService) {}

  // ───────────────────────────── Public layout ─────────────────────────────

  /** Публичная планировка для гостя (только visibleToGuests + isActive столы). Cache-Aside. */
  @Get('public')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  getPublicLayout(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.floorPlansService.getPublicLayout(restaurantId);
  }

  // ───────────────────────────── Admin layout ──────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  getLayout(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.floorPlansService.getLayout(restaurantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  createFloorPlan(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateFloorPlanDto,
  ) {
    return this.floorPlansService.createFloorPlan(restaurantId, dto);
  }

  @Patch(':floorPlanId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  updateFloorPlan(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('floorPlanId', ParseUuidV7Pipe) floorPlanId: string,
    @Body() dto: UpdateFloorPlanDto,
  ) {
    return this.floorPlansService.updateFloorPlan(restaurantId, floorPlanId, dto);
  }

  @Delete(':floorPlanId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  async deleteFloorPlan(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('floorPlanId', ParseUuidV7Pipe) floorPlanId: string,
  ) {
    await this.floorPlansService.deleteFloorPlan(restaurantId, floorPlanId);
  }

  /** Atomic bulk-сохранение всей планировки зоны (decor + столы) одним запросом. */
  @Put(':floorPlanId/layout')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  saveLayout(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('floorPlanId', ParseUuidV7Pipe) floorPlanId: string,
    @Body() dto: SaveLayoutDto,
  ) {
    return this.floorPlansService.saveLayout(restaurantId, floorPlanId, dto);
  }

  // ──────────────────────────── Table CRUD ─────────────────────────────────

  @Post(':floorPlanId/tables')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  createTable(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('floorPlanId', ParseUuidV7Pipe) floorPlanId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.floorPlansService.createTable(restaurantId, floorPlanId, dto);
  }

  @Patch('tables/:tableId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  updateTable(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('tableId', ParseUuidV7Pipe) tableId: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.floorPlansService.updateTable(restaurantId, tableId, dto);
  }

  @Delete('tables/:tableId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  async deleteTable(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('tableId', ParseUuidV7Pipe) tableId: string,
  ) {
    await this.floorPlansService.deleteTable(restaurantId, tableId);
  }
}
