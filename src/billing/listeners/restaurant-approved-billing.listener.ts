import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RestaurantApprovedEvent } from '../../restaurants/events/restaurant-approved.event';
import { BillingPlanCode } from '../enums/billing-plan-code.enum';
import { BillingSubscriptionService } from '../billing-subscription.service';

@Injectable()
export class RestaurantApprovedBillingListener {
  constructor(
    private readonly subscriptionService: BillingSubscriptionService,
  ) {}

  @OnEvent('restaurant.approved')
  async handleRestaurantApproved(
    event: RestaurantApprovedEvent,
  ): Promise<void> {
    await this.subscriptionService.startTrialForRestaurant(
      event.restaurantId,
      BillingPlanCode.SITE,
    );
  }
}
