import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { OrderStatusChangedEvent } from '../events/order-status-changed.event';

const BASE_TRANSITIONS: Record<PreOrderStatus, PreOrderStatus[]> = {
  [PreOrderStatus.NEW]: [PreOrderStatus.ACCEPTED, PreOrderStatus.CANCELLED],
  [PreOrderStatus.ACCEPTED]: [
    PreOrderStatus.PREPARING,
    PreOrderStatus.READY,
    PreOrderStatus.CANCELLED,
  ],
  [PreOrderStatus.PREPARING]: [PreOrderStatus.READY, PreOrderStatus.CANCELLED],
  [PreOrderStatus.READY]: [PreOrderStatus.COMPLETED, PreOrderStatus.CANCELLED],
  [PreOrderStatus.COMPLETED]: [],
  [PreOrderStatus.CANCELLED]: [],
};

const FULL_STAFF_ROLES = new Set<UserRole>([
  UserRole.RESTAURANT_ADMIN,
  UserRole.RESTAURANT_MANAGER,
  UserRole.RESTAURANT_HALL,
  UserRole.SUPER_ADMIN,
]);

const PRODUCTION_ALLOWED: Record<PreOrderStatus, PreOrderStatus[]> = {
  [PreOrderStatus.NEW]: [],
  [PreOrderStatus.ACCEPTED]: [PreOrderStatus.PREPARING, PreOrderStatus.READY],
  [PreOrderStatus.PREPARING]: [PreOrderStatus.READY],
  [PreOrderStatus.READY]: [],
  [PreOrderStatus.COMPLETED]: [],
  [PreOrderStatus.CANCELLED]: [],
};

const TELEGRAM_ALLOWED: Record<PreOrderStatus, PreOrderStatus[]> = {
  [PreOrderStatus.NEW]: [PreOrderStatus.ACCEPTED, PreOrderStatus.CANCELLED],
  [PreOrderStatus.ACCEPTED]: [],
  [PreOrderStatus.PREPARING]: [],
  [PreOrderStatus.READY]: [],
  [PreOrderStatus.COMPLETED]: [],
  [PreOrderStatus.CANCELLED]: [],
};

export function isStatusTransitionAllowed(params: {
  from: PreOrderStatus;
  to: PreOrderStatus;
  actor: OrderStatusChangedEvent['actor'];
  actorRole?: UserRole;
}): boolean {
  if (!BASE_TRANSITIONS[params.from].includes(params.to)) {
    return false;
  }

  if (params.actor.type === 'telegram') {
    return TELEGRAM_ALLOWED[params.from].includes(params.to);
  }

  if (params.actorRole === UserRole.RESTAURANT_PRODUCTION) {
    return PRODUCTION_ALLOWED[params.from].includes(params.to);
  }

  if (params.actorRole && FULL_STAFF_ROLES.has(params.actorRole)) {
    return true;
  }

  if (
    params.actor.type === 'staff' ||
    params.actor.type === 'system' ||
    params.actor.type === 'payment'
  ) {
    return (
      params.actorRole === undefined || FULL_STAFF_ROLES.has(params.actorRole)
    );
  }

  return false;
}
