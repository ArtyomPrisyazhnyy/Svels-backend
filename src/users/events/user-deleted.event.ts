export class UserDeletedEvent {
  static readonly EVENT = 'user.deleted';

  constructor(
    public readonly userId: string,
    public readonly restaurantId: string | null,
  ) {}
}
