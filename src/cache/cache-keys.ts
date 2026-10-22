/** TTL (seconds) for shared cache entries. */
export const CacheTtl = {
  publicRestaurant: 3600,
  domainNegative: 60,
  userAuth: 120,
} as const;

/** Stored as raw Redis value (not JSON) to represent a cached negative lookup. */
export const CACHE_NULL_SENTINEL = '__CACHE_NULL__';

export const CacheKeys = {
  menu: (restaurantId: string) => `restaurant:${restaurantId}:menu`,
  schedules: (restaurantId: string) => `restaurant:${restaurantId}:schedules`,
  /** Полная планировка зон/столов/decor для админа (включает невидимые гостям столы). */
  floorPlan: (restaurantId: string) => `restaurant:${restaurantId}:floor-plan`,
  /** Публичная планировка для гостя (только visibleToGuests + isActive столы). */
  publicLayout: (restaurantId: string) =>
    `restaurant:${restaurantId}:public-layout`,
  /** Занятость столов на дату: Map<tableId, busyUntil>. */
  tableAvailability: (restaurantId: string, date: string) =>
    `restaurant:${restaurantId}:availability:${date}`,
  bookingSettings: (restaurantId: string) =>
    `restaurant:${restaurantId}:booking-settings`,
  promoBanners: (restaurantId: string) =>
    `restaurant:${restaurantId}:promo-banners`,
  loyaltySettings: (restaurantId: string) =>
    `restaurant:${restaurantId}:loyalty-settings`,
  restaurantByDomain: (domain: string) => `restaurant:domain:${domain}`,
  restaurantPublic: (restaurantId: string) =>
    `restaurant:${restaurantId}:public`,
  restaurantLocations: (restaurantId: string) =>
    `restaurant:${restaurantId}:locations`,
  styling: (restaurantId: string) => `restaurant:${restaurantId}:styling`,
  orderSettings: (restaurantId: string) =>
    `restaurant:${restaurantId}:order-settings`,
  socialLinks: (restaurantId: string) =>
    `restaurant:${restaurantId}:social-links`,
  userAuth: (userId: string) => `user:${userId}:auth`,
  /** Redis-лок для конкурентного бронирования стола на слот. */
  bookingTableLock: (tableId: string, slotStartIso: string) =>
    `lock:booking:table:${tableId}:${slotStartIso}`,
  /** Гостевой OTP: restaurant + phone. */
  guestOtp: (restaurantId: string, phone: string) =>
    `otp:guest:${restaurantId}:${phone}`,
} as const;

/**
 * Все статические ключи кэша заведения (без дат availability — их нельзя перечислить без SCAN).
 * Используется при удалении ресторана.
 */
export function restaurantScopedCacheKeys(restaurantId: string): string[] {
  return [
    CacheKeys.menu(restaurantId),
    CacheKeys.schedules(restaurantId),
    CacheKeys.floorPlan(restaurantId),
    CacheKeys.publicLayout(restaurantId),
    CacheKeys.bookingSettings(restaurantId),
    CacheKeys.promoBanners(restaurantId),
    CacheKeys.loyaltySettings(restaurantId),
    CacheKeys.restaurantPublic(restaurantId),
    CacheKeys.restaurantLocations(restaurantId),
    CacheKeys.styling(restaurantId),
    CacheKeys.orderSettings(restaurantId),
    CacheKeys.socialLinks(restaurantId),
  ];
}
