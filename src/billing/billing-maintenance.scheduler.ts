import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  BILLING_MAINTENANCE_DAILY_JOB,
  BILLING_MAINTENANCE_QUEUE,
} from './billing.constants';

@Injectable()
export class BillingMaintenanceScheduler implements OnModuleInit {
  private readonly logger = new Logger(BillingMaintenanceScheduler.name);

  constructor(
    @InjectQueue(BILLING_MAINTENANCE_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      BILLING_MAINTENANCE_DAILY_JOB,
      {},
      {
        jobId: 'billing-maintenance-daily-repeat',
        repeat: { pattern: '0 3 * * *' },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    this.logger.log('Scheduled daily billing maintenance job (03:00 UTC)');
  }
}
