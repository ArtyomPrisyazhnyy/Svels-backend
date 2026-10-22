import {
  CacheKeys,
  restaurantScopedCacheKeys,
} from './cache-keys';

describe('CacheKeys', () => {
  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  it('builds stable restaurant-scoped keys', () => {
    expect(CacheKeys.menu(restaurantId)).toBe(
      `restaurant:${restaurantId}:menu`,
    );
    expect(CacheKeys.restaurantPublic(restaurantId)).toBe(
      `restaurant:${restaurantId}:public`,
    );
    expect(CacheKeys.userAuth('user-id')).toBe('user:user-id:auth');
  });

  it('lists all static restaurant keys for delete', () => {
    const keys = restaurantScopedCacheKeys(restaurantId);
    expect(keys).toContain(CacheKeys.menu(restaurantId));
    expect(keys).toContain(CacheKeys.styling(restaurantId));
    expect(keys).toContain(CacheKeys.socialLinks(restaurantId));
    expect(keys).not.toContain(
      CacheKeys.tableAvailability(restaurantId, '2026-01-01'),
    );
  });
});
