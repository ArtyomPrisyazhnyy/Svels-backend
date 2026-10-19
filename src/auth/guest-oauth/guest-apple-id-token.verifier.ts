import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { IGuestAppleIdTokenVerifier } from './interfaces/guest-id-token-verifier.interface';
import type { VerifiedGuestOAuthProfile } from './interfaces/verified-guest-oauth-profile.interface';

const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');
const APPLE_ISSUER = 'https://appleid.apple.com';

@Injectable()
export class GuestAppleIdTokenVerifier implements IGuestAppleIdTokenVerifier {
  private readonly logger = new Logger(GuestAppleIdTokenVerifier.name);
  private jwks: JWTVerifyGetKey | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getServiceId(): string {
    return this.configService.get<string>('guestOAuth.appleServiceId') ?? '';
  }

  isEnabled(): boolean {
    const serviceId = this.getServiceId();
    const teamId = this.configService.get<string>('guestOAuth.appleTeamId');
    const redirectUri = this.configService.get<string>(
      'guestOAuth.appleRedirectUri',
    );
    return Boolean(serviceId && teamId && redirectUri);
  }

  getServiceIdForClient(): string | null {
    return this.getServiceId() || null;
  }

  getRedirectUriForClient(): string | null {
    const redirectUri =
      this.configService.get<string>('guestOAuth.appleRedirectUri') ?? '';
    return redirectUri || null;
  }

  private getJwks(): JWTVerifyGetKey {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(APPLE_JWKS_URL);
    }
    return this.jwks;
  }

  async verify(idToken: string): Promise<VerifiedGuestOAuthProfile> {
    const audience = this.getServiceId();
    if (!this.isEnabled() || !audience) {
      throw new ForbiddenException('Apple OAuth не настроен');
    }

    try {
      const { payload } = await jwtVerify(idToken, this.getJwks(), {
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
