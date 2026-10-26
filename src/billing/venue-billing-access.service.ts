import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  effectiveSubscriptionStatus,
  isPublicVenueBlocked,
} from './billing-status-machine';
import { VENUE_UNAVAILABLE_MESSAGE } from './billing.constants';
import { BillingSubscription } from './entities/billing-subscription.entity';

@Injectable()
export class VenueBillingAccessService {
  constructor(
    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepository: Repository<BillingSubscription>,
  ) {}

  async assertPublicVenueAvailable(restaurantId: string): Promise<void> {
    const blocked = await this.isPublicVenueBlocked(restaurantId);
    if (blocked) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: VENUE_UNAVAILABLE_MESSAGE,
        error: 'VenueTemporarilyUnavailable',
      });
    }
  }

  async isPublicVenueBlocked(restaurantId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { restaurantId },
    });
    if (!subscription) {
      return false;
    }

    const now = new Date();
    const status = effectiveSubscriptionStatus(
      subscription.status,
      subscription.trialEndsAt,
      subscription.paidUntil,
      now,
    );
    return isPublicVenueBlocked(status);
  }
}
