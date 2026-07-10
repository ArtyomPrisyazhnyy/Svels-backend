import { PendingRegistrationDto } from '../../shared/dto/pending-registration.dto';

export type RegistrationStreamEventType =
  | 'registration.submitted'
  | 'registration.reviewed';

export interface RegistrationStreamMessage {
  type: RegistrationStreamEventType;
  data: PendingRegistrationDto | { requestId: string };
}
