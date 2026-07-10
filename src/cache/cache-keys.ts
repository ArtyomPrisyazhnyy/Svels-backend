export const CacheKeys = {
  menu: (restaurantId: string) => `restaurant:${restaurantId}:menu`,
  schedules: (restaurantId: string) => `restaurant:${restaurantId}:schedules`,
  /** Полная планировка зон/столов/decor для админа (включает невидимые гостям столы). */
  floorPlan: (restaurantId: string) => `restaurant:${restaurantId}:floor-plan`,
  /** Публичная планировка для гостя (только visibleToGuests + isActive столы). */
  publicLayout: (restaurantId: string) => `restaurant:${restaurantId}:public-layout`,
  /** Занятость столов на дату: Map<tableId, busyUntil>. */
  tableAvailability: (restaurantId: string, date: string) =>
    `restaurant:${restaurantId}:availability:${date}`,
  bookingSettings: (restaurantId: string) => `restaurant:${restaurantId}:booking-settings`,
  restaurantByDomain: (domain: string) => `restaurant:domain:${domain}`,
  /** Redis-лок для конкурентного бронирования стола на слот. */
  bookingTableLock: (tableId: string, slotStartIso: string) =>
    `lock:booking:table:${tableId}:${slotStartIso}`,
} as const;
