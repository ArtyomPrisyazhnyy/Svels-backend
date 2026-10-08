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
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { SchedulesService } from './schedules.service';

@Controller('restaurants/:restaurantId/schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  getSchedules(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.schedulesService.getByRestaurant(restaurantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_SCHEDULE)
  create(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(restaurantId, dto);
  }

  @Patch(':scheduleId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_SCHEDULE)
  update(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('scheduleId', ParseUuidV7Pipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(restaurantId, scheduleId, dto);
  }
}
