import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import type { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import { StaffChangeOrderStatusDto } from './dto/staff-change-order-status.dto';
import { StaffListPreOrdersQueryDto } from './dto/staff-list-pre-orders-query.dto';
import { PreOrdersStaffService } from './pre-orders-staff.service';
import { PreOrdersService } from './pre-orders.service';

@Controller()
export class PreOrdersController {
  constructor(
    private readonly preOrdersService: PreOrdersService,
    private readonly preOrdersStaffService: PreOrdersStaffService,
  ) {}

  @Post('restaurants/:restaurantId/pre-orders')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePreOrderDto,
  ) {
    return this.preOrdersService.create(restaurantId, user.id, dto);
  }

  @Get('users/me/pre-orders')
  @UseGuards(JwtAuthGuard)
  getMyPreOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.preOrdersService.findByUser(user.id);
  }

  @Get('users/me/pre-orders/:preOrderId')
  @UseGuards(JwtAuthGuard)
  getPreOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('preOrderId', ParseUuidV7Pipe) preOrderId: string,
  ) {
    return this.preOrdersService.findById(preOrderId, user.id);
  }

  @Get('restaurants/:restaurantId/pre-orders')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.VIEW_ORDERS)
  listStaffOrders(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Query() query: StaffListPreOrdersQueryDto,
  ) {
    return this.preOrdersStaffService.listForRestaurant(restaurantId, query);
  }

  @Get('restaurants/:restaurantId/pre-orders/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.VIEW_ORDERS)
  getStaffOrder(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('orderId', ParseUuidV7Pipe) orderId: string,
  ) {
    return this.preOrdersStaffService.getById(restaurantId, orderId);
  }

  @Patch('restaurants/:restaurantId/pre-orders/:orderId/status')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.VIEW_ORDERS)
  changeStaffOrderStatus(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('orderId', ParseUuidV7Pipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StaffChangeOrderStatusDto,
  ) {
    return this.preOrdersStaffService.changeStatus({
      restaurantId,
      orderId,
      to: dto.status,
      cancelReason: dto.cancelReason,
      actor: { type: 'staff', userId: user.id },
      actorRole: user.role as UserRole,
    });
  }
}
