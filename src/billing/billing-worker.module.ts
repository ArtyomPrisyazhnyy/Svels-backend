import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import billingConfig from '../config/billing.config';
import databaseConfig from '../config/database.config';
import redisConfig from '../config/redis.config';
import { DatabaseModule } from '../database/database.module';
import { BillingMaintenanceProcessor } from './billing-maintenance.processor';
import { BillingMaintenanceScheduler } from './billing-maintenance.scheduler';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BILLING_MAINTENANCE_QUEUE } from './billing.constants';
import { BillingPlan } from './entities/billing-plan.entity';
import { BillingSubscription } from './entities/billing-subscription.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingPlanService } from './billing-plan.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, billingConfig],
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([BillingPlan, BillingSubscription]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password') || undefined,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: BILLING_MAINTENANCE_QUEUE }),
  ],
  providers: [
    BillingPlanService,
    BillingSubscriptionService,
    BillingMaintenanceProcessor,
    BillingMaintenanceScheduler,
  ],
})
export class BillingWorkerModule {}
