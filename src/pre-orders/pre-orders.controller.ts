import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreatePreOrderDto } from './dto/pre-order.dto';
import { PreOrdersService } from './pre-orders.service';

@Controller()
export class PreOrdersController {
  constructor(private readonly preOrdersService: PreOrdersService) {}

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
}
