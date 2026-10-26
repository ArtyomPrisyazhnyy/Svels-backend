import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingPlanCode } from './enums/billing-plan-code.enum';
import { BillingPlan } from './entities/billing-plan.entity';

@Injectable()
export class BillingPlanSyncService implements OnModuleInit {
  private readonly logger = new Logger(BillingPlanSyncService.name);

  constructor(
    @InjectRepository(BillingPlan)
    private readonly planRepository: Repository<BillingPlan>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const priceByCode: Record<BillingPlanCode, number> = {
      [BillingPlanCode.SITE]: this.configService.get<number>(
        'billing.planSitePriceMonthlyByn',
        120,
      ),
      [BillingPlanCode.APP]: this.configService.get<number>(
        'billing.planAppPriceMonthlyByn',
        150,
      ),
      [BillingPlanCode.COMBO]: this.configService.get<number>(
        'billing.planComboPriceMonthlyByn',
        250,
      ),
    };

    const plans = await this.planRepository.find();
    for (const plan of plans) {
      const nextPrice = priceByCode[plan.code];
      const asString = nextPrice.toFixed(2);
      if (plan.priceMonthlyByn !== asString) {
        plan.priceMonthlyByn = asString;
        await this.planRepository.save(plan);
        this.logger.log(`Updated plan ${plan.code} price to ${asString} BYN`);
      }
    }
  }
}
