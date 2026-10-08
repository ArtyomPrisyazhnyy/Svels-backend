import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT опционален: битый/просроченный Bearer не валит запрос.
 * Гостевые эндпоинты продолжают работу по X-Guest-Id.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = request.headers.authorization ?? request.headers.Authorization;
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header) {
      return true;
    }

    try {
      return Boolean(await super.canActivate(context));
    } catch {
      return true;
    }
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
