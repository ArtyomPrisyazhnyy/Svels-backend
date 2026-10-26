import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BillingInvoiceService } from './billing-invoice.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { RestaurantOwnerBillingGuard } from './guards/restaurant-owner-billing.guard';

@Controller('billing/restaurants/:restaurantId')
@UseGuards(JwtAuthGuard, RestaurantOwnerBillingGuard)
export class BillingOwnerController {
  constructor(
    private readonly subscriptionService: BillingSubscriptionService,
    private readonly invoiceService: BillingInvoiceService,
  ) {}

  @Get('me')
  async getMyBilling(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
  ) {
    const subscription =
      await this.subscriptionService.getByRestaurantIdOrThrow(restaurantId);
    const invoices = await this.invoiceService.listForRestaurant(restaurantId);
    const plan = subscription.plan;

    return {
      subscription: {
        id: subscription.id,
        restaurantId: subscription.restaurantId,
        planId: subscription.planId,
        planCode: plan?.code,
        planName: plan?.name,
        priceMonthlyByn: plan?.priceMonthlyByn,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        paidUntil: subscription.paidUntil,
      },
      invoices,
    };
  }

  @Get('invoices/:invoiceId/pdf')
  async downloadInvoicePdf(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('invoiceId', ParseUuidV7Pipe) invoiceId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { buffer, filename } = await this.invoiceService.getInvoicePdf(
      invoiceId,
      restaurantId,
    );
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  }
}
