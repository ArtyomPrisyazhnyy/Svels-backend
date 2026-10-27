import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Injectable()
export class RestaurantOwnerBillingGuard implements CanActivate {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params: { restaurantId: string };
    }>();

    const user = request.user;
    const restaurantId = request.params.restaurantId;

    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }

    if ((user.role as UserRole) === UserRole.SUPER_ADMIN) {
      return true;
    }

    const isOwner = restaurant.ownerId === user.id;
    const isRestaurantAdmin =
      (user.role as UserRole) === UserRole.RESTAURANT_ADMIN &&
      user.restaurantId === restaurantId;

    if (!isOwner && !isRestaurantAdmin) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return true;
  }
}
