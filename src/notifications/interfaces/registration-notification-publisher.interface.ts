import { PendingRegistrationDto } from '../../shared/dto/pending-registration.dto';

export interface IRegistrationNotificationPublisher {
  publishSubmitted(registration: PendingRegistrationDto): void;
  publishReviewed(requestId: string): void;
}
