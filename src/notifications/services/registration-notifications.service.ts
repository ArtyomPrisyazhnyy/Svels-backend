import { Injectable } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PendingRegistrationDto } from '../../shared/dto/pending-registration.dto';
import { RegistrationStreamMessage } from '../dto/registration-stream-message.dto';
import { IRegistrationNotificationPublisher } from '../interfaces/registration-notification-publisher.interface';

type StreamSubscriber = (message: RegistrationStreamMessage) => void;

@Injectable()
export class RegistrationNotificationsService implements IRegistrationNotificationPublisher {
  private readonly subscribers = new Set<StreamSubscriber>();

  publishSubmitted(registration: PendingRegistrationDto): void {
    this.broadcast({
      type: 'registration.submitted',
      data: registration,
    });
  }

  publishReviewed(requestId: string): void {
    this.broadcast({
      type: 'registration.reviewed',
      data: { requestId },
    });
  }

  createStream(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const send: StreamSubscriber = (message) => {
        subscriber.next({ data: JSON.stringify(message) });
      };

      this.subscribers.add(send);

      const heartbeat = setInterval(() => {
        subscriber.next({ data: JSON.stringify({ type: 'heartbeat' }) });
      }, 30_000);

      return () => {
        clearInterval(heartbeat);
        this.subscribers.delete(send);
      };
    });
  }

  private broadcast(message: RegistrationStreamMessage): void {
    for (const subscriber of this.subscribers) {
      subscriber(message);
    }
  }
}
