import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isRestaurantStaffRole } from '../../common/auth/restaurant-role-permissions';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { VenueBillingAccessService } from '../venue-billing-access.service';

interface JwtPayload {
  sub: string;
  role: string;
  restaurantId?: string;
}

@Injectable()
export class VenueSuspensionGuard implements CanActivate {
  constructor(
    private readonly venueBillingAccessService: VenueBillingAccessService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers?: { authorization?: string };
      params: { restaurantId?: string };
    }>();

    const restaurantId = request.params?.restaurantId;
    if (!restaurantId) {
      return true;
    }

    if (this.isStaffAccess(request.user, restaurantId)) {
      return true;
    }

    if (
      await this.isStaffFromBearer(request.headers?.authorization, restaurantId)
    ) {
      return true;
    }

    await this.venueBillingAccessService.assertPublicVenueAvailable(
      restaurantId,
    );
    return true;
  }

  private isStaffAccess(
    user: AuthenticatedUser | undefined,
    restaurantId: string,
  ): boolean {
    if (!user) {
      return false;
    }
    if ((user.role as UserRole) === UserRole.SUPER_ADMIN) {
      return true;
    }
    return (
      isRestaurantStaffRole(user.role) && user.restaurantId === restaurantId
    );
  }

  private async isStaffFromBearer(
    authorization: string | undefined,
    restaurantId: string,
  ): Promise<boolean> {
    if (!authorization?.startsWith('Bearer ')) {
      return false;
    }
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      return false;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const role = payload.role as UserRole;
      if (role === UserRole.SUPER_ADMIN) {
        return true;
      }
      return (
        isRestaurantStaffRole(role) && payload.restaurantId === restaurantId
      );
    } catch {
      return false;
    }
  }
}
