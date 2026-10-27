import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import billingConfig from '../config/billing.config';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { BillingAdminController } from './billing-admin.controller';
import { BillingInvoiceNumberingService } from './billing-invoice-numbering.service';
import { BillingInvoiceService } from './billing-invoice.service';
import { BillingOwnerController } from './billing-owner.controller';
import { BillingPdfService } from './billing-pdf.service';
import { BillingPlanService } from './billing-plan.service';
import { BillingPlanSyncService } from './billing-plan-sync.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingInvoiceSequence } from './entities/billing-invoice-sequence.entity';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { BillingPlan } from './entities/billing-plan.entity';
import { BillingSubscription } from './entities/billing-subscription.entity';
import { RestaurantOwnerBillingGuard } from './guards/restaurant-owner-billing.guard';
import { VenueSuspensionGuard } from './guards/venue-suspension.guard';
import { RestaurantApprovedBillingListener } from './listeners/restaurant-approved-billing.listener';
import { VenueBillingAccessService } from './venue-billing-access.service';

@Module({
  imports: [
    ConfigModule.forFeature(billingConfig),
    TypeOrmModule.forFeature([
      BillingPlan,
      BillingSubscription,
      BillingInvoice,
      BillingInvoiceSequence,
      Restaurant,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [BillingAdminController, BillingOwnerController],
  providers: [
    BillingPlanService,
    BillingPlanSyncService,
    BillingSubscriptionService,
    BillingInvoiceService,
    BillingInvoiceNumberingService,
    BillingPdfService,
    VenueBillingAccessService,
    RestaurantOwnerBillingGuard,
    RestaurantApprovedBillingListener,
    {
      provide: APP_GUARD,
      useClass: VenueSuspensionGuard,
    },
  ],
  exports: [VenueBillingAccessService, BillingSubscriptionService],
})
export class BillingModule {}
