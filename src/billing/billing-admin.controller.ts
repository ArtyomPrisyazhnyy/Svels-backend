import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { BillingInvoiceService } from './billing-invoice.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import {
  ChangeSubscriptionPlanDto,
  CreateInvoiceDto,
  ExtendTrialDto,
} from './dto/billing-admin.dto';

@Controller('billing/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BillingAdminController {
  constructor(
    private readonly subscriptionService: BillingSubscriptionService,
    private readonly invoiceService: BillingInvoiceService,
  ) {}

  @Get('subscriptions')
  listSubscriptions() {
    return this.subscriptionService.listSubscriptions();
  }

  @Post('restaurants/:restaurantId/invoices')
  @HttpCode(201)
  createInvoice(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoiceService.createInvoice(restaurantId, dto.periodStart);
  }

  @Post('invoices/:invoiceId/void')
  voidInvoice(@Param('invoiceId', ParseUuidV7Pipe) invoiceId: string) {
    return this.invoiceService.voidInvoice(invoiceId);
  }

  @Post('invoices/:invoiceId/mark-paid')
  @HttpCode(201)
  async markInvoicePaid(@Param('invoiceId', ParseUuidV7Pipe) invoiceId: string) {
    const result = await this.invoiceService.markInvoicePaid(invoiceId);
    const subscription = await this.subscriptionService.getByRestaurantIdOrThrow(
      result.subscriptionRestaurantId,
    );
    return {
      invoice: result.invoice,
      subscription: {
        id: subscription.id,
        restaurantId: subscription.restaurantId,
        status: subscription.status,
        paidUntil: subscription.paidUntil,
      },
    };
  }

  @Patch('restaurants/:restaurantId/plan')
  changePlan(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    return this.subscriptionService.changePlan(restaurantId, dto.planId);
  }

  @Patch('restaurants/:restaurantId/trial')
  extendTrial(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: ExtendTrialDto,
  ) {
    return this.subscriptionService.extendTrial(restaurantId, dto.trialEndsAt);
  }
}
