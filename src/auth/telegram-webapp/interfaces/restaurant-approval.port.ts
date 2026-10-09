export interface RestaurantApprovalPort {
  ensureApproved(restaurantId: string): Promise<unknown>;
}
