import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { isStatusTransitionAllowed } from './order-status-transitions';

describe('isStatusTransitionAllowed transition table', () => {
  const hall = {
    actor: { type: 'staff' as const, userId: 'u1' },
    actorRole: UserRole.RESTAURANT_HALL,
  };

  const cases: Array<[PreOrderStatus, PreOrderStatus, boolean]> = [
    [PreOrderStatus.NEW, PreOrderStatus.ACCEPTED, true],
    [PreOrderStatus.NEW, PreOrderStatus.CANCELLED, true],
    [PreOrderStatus.NEW, PreOrderStatus.READY, false],
    [PreOrderStatus.ACCEPTED, PreOrderStatus.PREPARING, true],
    [PreOrderStatus.ACCEPTED, PreOrderStatus.READY, true],
    [PreOrderStatus.ACCEPTED, PreOrderStatus.CANCELLED, true],
    [PreOrderStatus.PREPARING, PreOrderStatus.READY, true],
    [PreOrderStatus.PREPARING, PreOrderStatus.CANCELLED, true],
    [PreOrderStatus.READY, PreOrderStatus.COMPLETED, true],
    [PreOrderStatus.READY, PreOrderStatus.CANCELLED, true],
    [PreOrderStatus.COMPLETED, PreOrderStatus.CANCELLED, false],
    [PreOrderStatus.CANCELLED, PreOrderStatus.NEW, false],
  ];

  it.each(cases)('hall %s -> %s = %s', (from, to, expected) => {
    expect(
      isStatusTransitionAllowed({
        from,
        to,
        ...hall,
      }),
    ).toBe(expected);
  });
});

describe('isStatusTransitionAllowed role rules', () => {
  it('allows hall full transitions from new', () => {
    expect(
      isStatusTransitionAllowed({
        from: PreOrderStatus.NEW,
        to: PreOrderStatus.ACCEPTED,
        actor: { type: 'staff', userId: 'u1' },
        actorRole: UserRole.RESTAURANT_HALL,
      }),
    ).toBe(true);
  });

  it('restricts production to kitchen transitions', () => {
    expect(
      isStatusTransitionAllowed({
        from: PreOrderStatus.NEW,
        to: PreOrderStatus.ACCEPTED,
        actor: { type: 'staff', userId: 'u1' },
        actorRole: UserRole.RESTAURANT_PRODUCTION,
      }),
    ).toBe(false);
    expect(
      isStatusTransitionAllowed({
        from: PreOrderStatus.ACCEPTED,
        to: PreOrderStatus.PREPARING,
        actor: { type: 'staff', userId: 'u1' },
        actorRole: UserRole.RESTAURANT_PRODUCTION,
      }),
    ).toBe(true);
    expect(
      isStatusTransitionAllowed({
        from: PreOrderStatus.ACCEPTED,
        to: PreOrderStatus.CANCELLED,
        actor: { type: 'staff', userId: 'u1' },
        actorRole: UserRole.RESTAURANT_PRODUCTION,
      }),
    ).toBe(false);
  });

  it('allows telegram only accept/reject from new', () => {
    expect(
      isStatusTransitionAllowed({
        from: PreOrderStatus.NEW,
        to: PreOrderStatus.CANCELLED,
        actor: { type: 'telegram', chatId: 'c1' },
      }),
    ).toBe(true);
    expect(
      isStatusTransitionAllowed({
        from: PreOrderStatus.ACCEPTED,
        to: PreOrderStatus.READY,
        actor: { type: 'telegram', chatId: 'c1' },
      }),
    ).toBe(false);
  });
});
