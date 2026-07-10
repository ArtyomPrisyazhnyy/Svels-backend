import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class RestaurantAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params: { restaurantId?: string; id?: string };
    }>();

    const user = request.user;
    const restaurantId = request.params.restaurantId ?? request.params.id;

    if (!restaurantId) {
      throw new ForbiddenException('Ресторан не указан');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (user.role !== UserRole.RESTAURANT_ADMIN) {
      throw new ForbiddenException('Недостаточно прав');
    }

    if (!user.restaurantId || user.restaurantId !== restaurantId) {
      throw new ForbiddenException('Нет доступа к этому ресторану');
    }

    return true;
  }
}
