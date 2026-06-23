export const CacheKeys = {
  menu: (restaurantId: string) => `restaurant:${restaurantId}:menu`,
  schedules: (restaurantId: string) => `restaurant:${restaurantId}:schedules`,
  floorPlan: (restaurantId: string) => `restaurant:${restaurantId}:floor-plan`,
} as const;
