export class RestaurantApprovedEvent {
  constructor(
    public readonly restaurantId: string,
    public readonly ownerId: string,
  ) {}
}
