import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFloorPlanDto, CreateTableDto, UpdateTableDto } from './dto/floor-plan.dto';
import { FloorPlansService } from './floor-plans.service';

@Controller('restaurants/:restaurantId/floor-plans')
export class FloorPlansController {
  constructor(private readonly floorPlansService: FloorPlansService) {}

  @Get()
  getFloorPlans(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.floorPlansService.getByRestaurant(restaurantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_ADMIN)
  createFloorPlan(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateFloorPlanDto,
  ) {
    return this.floorPlansService.createFloorPlan(restaurantId, dto);
  }

  @Post(':floorPlanId/tables')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_ADMIN)
  createTable(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('floorPlanId', ParseUuidV7Pipe) floorPlanId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.floorPlansService.createTable(restaurantId, floorPlanId, dto);
  }

  @Patch('tables/:tableId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_ADMIN)
  updateTable(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('tableId', ParseUuidV7Pipe) tableId: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.floorPlansService.updateTable(restaurantId, tableId, dto);
  }
}
