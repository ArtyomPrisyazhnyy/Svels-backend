import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { CapturePaymentDto, VoidPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Webhook bePaid (Basic Auth shopId:secretKey). */
  @Post('payments/bepaid/webhook')
  @HttpCode(200)
  @SkipThrottle()
  async bePaidWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const body = (request.body ?? {}) as Record<string, unknown>;
    await this.paymentsService.handleBePaidWebhook(authorization, body);
    return { ok: true };
  }

  @Get('payments/:paymentId')
  @UseGuards(JwtAuthGuard)
  getPayment(
    @Param('paymentId', ParseUuidV7Pipe) paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.getByIdForUser(paymentId, user.id);
  }

  @Post('payments/:paymentId/sync')
  @UseGuards(JwtAuthGuard)
  syncPayment(
    @Param('paymentId', ParseUuidV7Pipe) paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.syncFromCheckoutToken(paymentId, user.id);
  }

  @Post('restaurants/:restaurantId/pre-orders/:preOrderId/payments/capture')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_PAYMENTS)
  capture(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('preOrderId', ParseUuidV7Pipe) preOrderId: string,
    @Body() dto: CapturePaymentDto,
  ) {
    void dto;
    return this.paymentsService.captureByPreOrder(restaurantId, preOrderId);
  }

  @Post('restaurants/:restaurantId/pre-orders/:preOrderId/payments/void')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_PAYMENTS)
  voidPayment(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('preOrderId', ParseUuidV7Pipe) preOrderId: string,
    @Body() dto: VoidPaymentDto,
  ) {
    void dto;
    return this.paymentsService.voidByPreOrder(restaurantId, preOrderId);
  }
}
