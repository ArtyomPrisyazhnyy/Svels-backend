import { RestaurantPermission } from '../enums/restaurant-permission.enum';
import { UserRole } from '../enums/user-role.enum';
import {
  restaurantRoles,
  roleHasPermission,
} from './restaurant-role-permissions';

describe('restaurant role permissions', () => {
  it('gives the owner every restaurant permission including staff and payments', () => {
    expect(roleHasPermission(UserRole.RESTAURANT_ADMIN, RestaurantPermission.MANAGE_STAFF)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.RESTAURANT_ADMIN, RestaurantPermission.MANAGE_PAYMENTS)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.RESTAURANT_ADMIN, RestaurantPermission.VIEW_ORDERS)).toBe(
      true,
    );
  });

  it('lets a manager run operations but not branding, payments, domain or hiring', () => {
    expect(roleHasPermission(UserRole.RESTAURANT_MANAGER, RestaurantPermission.MANAGE_MENU)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.RESTAURANT_MANAGER, RestaurantPermission.VIEW_BOOKINGS)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.RESTAURANT_MANAGER, RestaurantPermission.MANAGE_BRANDING)).toBe(
      false,
    );
    expect(roleHasPermission(UserRole.RESTAURANT_MANAGER, RestaurantPermission.MANAGE_PAYMENTS)).toBe(
      false,
    );
    expect(
      roleHasPermission(UserRole.RESTAURANT_MANAGER, RestaurantPermission.MANAGE_RESTAURANT),
    ).toBe(false);
    expect(roleHasPermission(UserRole.RESTAURANT_MANAGER, RestaurantPermission.MANAGE_STAFF)).toBe(
      false,
    );
  });

  it('limits hall staff to bookings and live orders', () => {
    expect(roleHasPermission(UserRole.RESTAURANT_HALL, RestaurantPermission.VIEW_BOOKINGS)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.RESTAURANT_HALL, RestaurantPermission.VIEW_ORDERS)).toBe(true);
    expect(roleHasPermission(UserRole.RESTAURANT_HALL, RestaurantPermission.MANAGE_MENU)).toBe(
      false,
    );
  });

  it('limits production staff to the order queue', () => {
    expect(
      roleHasPermission(UserRole.RESTAURANT_PRODUCTION, RestaurantPermission.VIEW_ORDERS),
    ).toBe(true);
    expect(
      roleHasPermission(UserRole.RESTAURANT_PRODUCTION, RestaurantPermission.VIEW_BOOKINGS),
    ).toBe(false);
    expect(
      roleHasPermission(UserRole.RESTAURANT_PRODUCTION, RestaurantPermission.MANAGE_MENU),
    ).toBe(false);
  });

  it('expands menu permission to owner, manager and super admin', () => {
    expect(restaurantRoles(RestaurantPermission.MANAGE_MENU)).toEqual([
      UserRole.RESTAURANT_ADMIN,
      UserRole.RESTAURANT_MANAGER,
      UserRole.SUPER_ADMIN,
    ]);
  });

  it('includes hall staff in booking roles', () => {
    expect(restaurantRoles(RestaurantPermission.VIEW_BOOKINGS)).toEqual([
      UserRole.RESTAURANT_ADMIN,
      UserRole.RESTAURANT_MANAGER,
      UserRole.RESTAURANT_HALL,
      UserRole.SUPER_ADMIN,
    ]);
  });
});
