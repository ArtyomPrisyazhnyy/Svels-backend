export interface RestaurantsDomainResolver {
  resolveByDomain(rawHost: string): Promise<unknown>;
}
