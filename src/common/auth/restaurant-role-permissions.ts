import { RestaurantPermission } from '../enums/restaurant-permission.enum';
import { UserRole } from '../enums/user-role.enum';

export const RESTAURANT_STAFF_ROLES = [
  UserRole.RESTAURANT_ADMIN,
  UserRole.RESTAURANT_MANAGER,
  UserRole.RESTAURANT_HALL,
  UserRole.RESTAURANT_PRODUCTION,
] as const;

export type RestaurantStaffRole = (typeof RESTAURANT_STAFF_ROLES)[number];

export const PLATFORM_AUTH_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  ...RESTAURANT_STAFF_ROLES,
];

const ALL_PERMISSIONS = Object.values(RestaurantPermission);

const OWNER_ONLY_PERMISSIONS = new Set<RestaurantPermission>([
  RestaurantPermission.MANAGE_BRANDING,
  RestaurantPermission.MANAGE_PAYMENTS,
  RestaurantPermission.MANAGE_RESTAURANT,
  RestaurantPermission.MANAGE_STAFF,
]);

export const ROLE_PERMISSIONS: Record<
  RestaurantStaffRole,
  readonly RestaurantPermission[]
> = {
  [UserRole.RESTAURANT_ADMIN]: ALL_PERMISSIONS,
  [UserRole.RESTAURANT_MANAGER]: ALL_PERMISSIONS.filter(
    (permission) => !OWNER_ONLY_PERMISSIONS.has(permission),
  ),
  [UserRole.RESTAURANT_HALL]: [
    RestaurantPermission.VIEW_BOOKINGS,
    RestaurantPermission.VIEW_ORDERS,
  ],
  [UserRole.RESTAURANT_PRODUCTION]: [RestaurantPermission.VIEW_ORDERS],
};

export function isRestaurantStaffRole(
  role: string,
): role is RestaurantStaffRole {
  return (RESTAURANT_STAFF_ROLES as readonly string[]).includes(role);
}

export function roleHasPermission(
  role: string,
  permission: RestaurantPermission,
): boolean {
  if (!isRestaurantStaffRole(role)) {
    return false;
  }

  return ROLE_PERMISSIONS[role].includes(permission);
}

export function restaurantRoles(
  permission: RestaurantPermission,
  options?: { superAdmin?: boolean },
): UserRole[] {
  const roles: UserRole[] = RESTAURANT_STAFF_ROLES.filter((role) =>
    ROLE_PERMISSIONS[role].includes(permission),
  );

  if (options?.superAdmin !== false) {
    roles.push(UserRole.SUPER_ADMIN);
  }

  return roles;
}
