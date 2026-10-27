import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateUuidV7 } from '../common/utils/uuid.util';
import {
  addMonths,
  nextStatusAfterPastDue,
  shouldMarkPastDue,
  shouldMarkSuspended,
} from './billing-status-machine';
import { DEFAULT_TRIAL_DAYS } from './billing.constants';
import { BillingPlanCode } from './enums/billing-plan-code.enum';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import { BillingSubscription } from './entities/billing-subscription.entity';
import { BillingPlanService } from './billing-plan.service';
import { ConfigService } from '@nestjs/config';

export interface SubscriptionListItem {
  id: string;
  restaurantId: string;
  planId: string;
  planCode: BillingPlanCode;
  planName: string;
  priceMonthlyByn: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  pastDueSince: Date | null;
}

@Injectable()
export class BillingSubscriptionService {
  constructor(
    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepository: Repository<BillingSubscription>,
    private readonly planService: BillingPlanService,
    private readonly configService: ConfigService,
  ) {}

  async listSubscriptions(): Promise<SubscriptionListItem[]> {
    const rows = await this.subscriptionRepository.find({
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });

    return rows.map((row) => this.toListItem(row));
  }

  async getByRestaurantId(
    restaurantId: string,
  ): Promise<BillingSubscription | null> {
    return this.subscriptionRepository.findOne({
      where: { restaurantId },
      relations: { plan: true },
    });
  }

  async getByRestaurantIdOrThrow(
    restaurantId: string,
  ): Promise<BillingSubscription> {
    const subscription = await this.getByRestaurantId(restaurantId);
    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }
    return subscription;
  }

  async startTrialForRestaurant(
    restaurantId: string,
    planCode: BillingPlanCode = BillingPlanCode.SITE,
    trialDays: number = DEFAULT_TRIAL_DAYS,
  ): Promise<BillingSubscription> {
    const existing = await this.getByRestaurantId(restaurantId);
    if (existing) {
      return existing;
    }

    const plan = await this.planService.findByCode(planCode);
    const trialEndsAt = new Date();
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + trialDays);

    const subscription = this.subscriptionRepository.create({
      id: generateUuidV7(),
      restaurantId,
      planId: plan.id,
      status: SubscriptionStatus.TRIAL,
      trialEndsAt,
      paidUntil: null,
      pastDueSince: null,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async changePlan(
    restaurantId: string,
    planId: string,
  ): Promise<BillingSubscription> {
    const subscription = await this.getByRestaurantIdOrThrow(restaurantId);
    await this.planService.findById(planId);
    subscription.planId = planId;
    return this.subscriptionRepository.save(subscription);
  }

  async extendTrial(
    restaurantId: string,
    trialEndsAt: Date,
  ): Promise<BillingSubscription> {
    const subscription = await this.getByRestaurantIdOrThrow(restaurantId);
    if (trialEndsAt <= new Date()) {
      throw new BadRequestException(
        'Дата окончания пробного периода должна быть в будущем',
      );
    }
    subscription.trialEndsAt = trialEndsAt;
    if (
      subscription.status === SubscriptionStatus.PAST_DUE ||
      subscription.status === SubscriptionStatus.SUSPENDED
    ) {
      subscription.status = SubscriptionStatus.TRIAL;
      subscription.pastDueSince = null;
    } else if (subscription.status !== SubscriptionStatus.CANCELLED) {
      subscription.status = SubscriptionStatus.TRIAL;
    }
    return this.subscriptionRepository.save(subscription);
  }

  async markPaid(
    restaurantId: string,
    referenceDate: Date = new Date(),
  ): Promise<BillingSubscription> {
    const subscription = await this.getByRestaurantIdOrThrow(restaurantId);
    const base =
      subscription.paidUntil && subscription.paidUntil > referenceDate
        ? subscription.paidUntil
        : referenceDate;
    subscription.paidUntil = addMonths(base, 1);
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.pastDueSince = null;
    return this.subscriptionRepository.save(subscription);
  }

  async runDailyMaintenance(now: Date = new Date()): Promise<{
    pastDueCount: number;
    suspendedCount: number;
  }> {
    const graceDays = this.configService.get<number>(
      'billing.gracePeriodDays',
      7,
    );
    const subscriptions = await this.subscriptionRepository.find();
    let pastDueCount = 0;
    let suspendedCount = 0;

    for (const subscription of subscriptions) {
      if (subscription.status === SubscriptionStatus.CANCELLED) {
        continue;
      }

      if (
        shouldMarkSuspended(
          subscription.status,
          subscription.pastDueSince,
          graceDays,
          now,
        )
      ) {
        subscription.status = SubscriptionStatus.SUSPENDED;
        await this.subscriptionRepository.save(subscription);
        suspendedCount += 1;
        continue;
      }

      if (
        shouldMarkPastDue(
          subscription.status,
          subscription.paidUntil,
          subscription.trialEndsAt,
          now,
        )
      ) {
        if (subscription.status !== SubscriptionStatus.PAST_DUE) {
          subscription.status = nextStatusAfterPastDue(subscription.status);
          subscription.pastDueSince = subscription.pastDueSince ?? now;
          await this.subscriptionRepository.save(subscription);
          pastDueCount += 1;
        }
      }
    }

    return { pastDueCount, suspendedCount };
  }

  private toListItem(row: BillingSubscription): SubscriptionListItem {
    const plan = row.plan;
    if (!plan) {
      throw new Error('Plan relation missing for subscription list');
    }
    return {
      id: row.id,
      restaurantId: row.restaurantId,
      planId: row.planId,
      planCode: plan.code,
      planName: plan.name,
      priceMonthlyByn: plan.priceMonthlyByn,
      status: row.status,
      trialEndsAt: row.trialEndsAt,
      paidUntil: row.paidUntil,
      pastDueSince: row.pastDueSince,
    };
  }
}
