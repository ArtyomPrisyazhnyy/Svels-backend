import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import { GUEST_APPLE_JWKS_RESOLVER } from '../../common/constants/injection-tokens';
import type { GuestAppleJwksResolverFn } from './apple-jwks.resolver';
import type { IGuestAppleIdTokenVerifier } from './interfaces/guest-id-token-verifier.interface';
import type { VerifiedGuestOAuthProfile } from './interfaces/verified-guest-oauth-profile.interface';

const APPLE_ISSUER = 'https://appleid.apple.com';

@Injectable()
export class GuestAppleIdTokenVerifier implements IGuestAppleIdTokenVerifier {
  private readonly logger = new Logger(GuestAppleIdTokenVerifier.name);
  private jwksResolverFn: GuestAppleJwksResolverFn;

  constructor(
    private readonly configService: ConfigService,
    @Inject(GUEST_APPLE_JWKS_RESOLVER)
    jwksResolverFn: GuestAppleJwksResolverFn,
  ) {
    this.jwksResolverFn = jwksResolverFn;
  }

  private getServiceId(): string {
    return this.configService.get<string>('guestOAuth.appleServiceId') ?? '';
  }

  private isConfigured(): boolean {
    const serviceId = this.getServiceId();
    const teamId = this.configService.get<string>('guestOAuth.appleTeamId');
    const redirectUri = this.configService.get<string>(
      'guestOAuth.appleRedirectUri',
    );
    return Boolean(serviceId && teamId && redirectUri);
  }

  async verify(idToken: string): Promise<VerifiedGuestOAuthProfile> {
    const audience = this.getServiceId();
    if (!this.isConfigured() || !audience) {
      throw new ForbiddenException('Apple OAuth не настроен');
    }

    try {
      const { payload } = await jwtVerify(idToken, this.jwksResolverFn(), {
        issuer: APPLE_ISSUER,
        audience,
      });

      const sub = payload.sub;
      const email = payload.email;
      if (!sub || typeof email !== 'string' || !email.trim()) {
        throw new BadRequestException('Некорректный Apple токен');
      }

      return {
        subject: sub,
        email: email.toLowerCase(),
        firstName: 'User',
        lastName: '',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      const details = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Guest Apple token verification failed: ${details}`);
      throw new BadRequestException(
        'Некорректный или просроченный Apple токен',
      );
    }
  }
}
