import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CacheKeys, CacheTtl } from '../../cache/cache-keys';
import { CacheService } from '../../cache/cache.service';
import { USERS_SERVICE } from '../../common/constants/injection-tokens';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { IUsersService } from '../../users/interfaces/users-service.interface';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  restaurantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const cacheKey = CacheKeys.userAuth(payload.sub);
    const cached = await this.cacheService.get<AuthenticatedUser>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    };

    await this.cacheService.set(cacheKey, authUser, CacheTtl.userAuth);
    return authUser;
  }
}
