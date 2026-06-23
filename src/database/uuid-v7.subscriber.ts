import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
} from 'typeorm';
import { generateUuidV7 } from '../common/utils/uuid.util';

interface EntityWithId {
  id?: string;
}

@EventSubscriber()
export class UuidV7Subscriber implements EntitySubscriberInterface<EntityWithId> {
  beforeInsert(event: InsertEvent<EntityWithId>): void {
    if (!event.entity.id) {
      event.entity.id = generateUuidV7();
    }
  }
}
