import { SetMetadata } from '@nestjs/common';
import { restaurantRoles } from '../auth/restaurant-role-permissions';
import { RestaurantPermission } from '../enums/restaurant-permission.enum';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Разворачивает право заведения в список ролей для существующего RolesGuard. */
export function StaffRoles(
  permission: RestaurantPermission,
  options?: { superAdmin?: boolean },
) {
  return Roles(...restaurantRoles(permission, options));
}
