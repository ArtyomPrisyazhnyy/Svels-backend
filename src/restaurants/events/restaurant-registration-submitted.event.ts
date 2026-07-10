import { PendingRegistrationDto } from '../../shared/dto/pending-registration.dto';

export class RestaurantRegistrationSubmittedEvent {
  constructor(public readonly registration: PendingRegistrationDto) {}
}
