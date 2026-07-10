import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { REGISTRATION_NOTIFICATION_PUBLISHER } from '../../common/constants/injection-tokens';
import { RestaurantRegistrationReviewedEvent } from '../../restaurants/events/restaurant-registration-reviewed.event';
import { RestaurantRegistrationSubmittedEvent } from '../../restaurants/events/restaurant-registration-submitted.event';
import type { IRegistrationNotificationPublisher } from '../interfaces/registration-notification-publisher.interface';

@Injectable()
export class RestaurantRegistrationListener {
  constructor(
    @Inject(REGISTRATION_NOTIFICATION_PUBLISHER)
    private readonly publisher: IRegistrationNotificationPublisher,
  ) {}

  @OnEvent('restaurant.registration.submitted')
  handleSubmitted(event: RestaurantRegistrationSubmittedEvent): void {
    this.publisher.publishSubmitted(event.registration);
  }

  @OnEvent('restaurant.registration.reviewed')
  handleReviewed(event: RestaurantRegistrationReviewedEvent): void {
    this.publisher.publishReviewed(event.requestId);
  }
}
