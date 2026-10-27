import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  BILLING_MAINTENANCE_DAILY_JOB,
  BILLING_MAINTENANCE_QUEUE,
} from './billing.constants';
import { BillingSubscriptionService } from './billing-subscription.service';

@Processor(BILLING_MAINTENANCE_QUEUE, { concurrency: 1 })
export class BillingMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingMaintenanceProcessor.name);

  constructor(
    private readonly subscriptionService: BillingSubscriptionService,
  ) {
    super();
  }

  async process(
    job: Job,
  ): Promise<{ pastDueCount: number; suspendedCount: number }> {
    if (job.name !== BILLING_MAINTENANCE_DAILY_JOB) {
      this.logger.warn(`Unknown billing job name: ${job.name}`);
      return { pastDueCount: 0, suspendedCount: 0 };
    }

    const result = await this.subscriptionService.runDailyMaintenance();
    this.logger.log(
      `Billing maintenance: past_due=${result.pastDueCount}, suspended=${result.suspendedCount}`,
    );
    return result;
  }
}
