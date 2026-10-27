import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingPlanCode } from './enums/billing-plan-code.enum';
import { BillingPlan } from './entities/billing-plan.entity';

@Injectable()
export class BillingPlanService {
  constructor(
    @InjectRepository(BillingPlan)
    private readonly planRepository: Repository<BillingPlan>,
  ) {}

  async findAllActive(): Promise<BillingPlan[]> {
    return this.planRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async findById(planId: string): Promise<BillingPlan> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Тариф не найден');
    }
    return plan;
  }

  async findByCode(code: BillingPlanCode): Promise<BillingPlan> {
    const plan = await this.planRepository.findOne({ where: { code } });
    if (!plan) {
      throw new NotFoundException('Тариф не найден');
    }
    return plan;
  }
}
