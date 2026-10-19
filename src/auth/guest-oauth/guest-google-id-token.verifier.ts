import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GUEST_GOOGLE_OAUTH2_CLIENT } from '../../common/constants/injection-tokens';
import type { IGuestGoogleIdTokenVerifier } from './interfaces/guest-id-token-verifier.interface';
import type { VerifiedGuestOAuthProfile } from './interfaces/verified-guest-oauth-profile.interface';

@Injectable()
export class GuestGoogleIdTokenVerifier implements IGuestGoogleIdTokenVerifier {
  private readonly logger = new Logger(GuestGoogleIdTokenVerifier.name);
  private readonly client: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(GUEST_GOOGLE_OAUTH2_CLIENT)
    client?: OAuth2Client,
  ) {
    this.client = client ?? new OAuth2Client();
  }

  private getAudiences(): string[] {
    return this.configService.get<string[]>('guestOAuth.googleClientIds') ?? [];
  }

  async verify(idToken: string): Promise<VerifiedGuestOAuthProfile> {
    const audiences = this.getAudiences();
    if (!audiences.length) {
      throw new ForbiddenException('Google OAuth не настроен');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: audiences,
      });

      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new BadRequestException('Некорректный Google токен');
      }

      if (!payload.email_verified) {
        throw new BadRequestException('Email Google не подтверждён');
      }

      return {
        subject: payload.sub,
        email: payload.email.toLowerCase(),
        firstName: payload.given_name ?? payload.name?.split(' ')[0] ?? 'User',
        lastName:
          payload.family_name ??
          payload.name?.split(' ').slice(1).join(' ') ??
          '',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      const details = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Guest Google token verification failed: ${details}`);
      throw new BadRequestException(
        'Некорректный или просроченный Google токен',
      );
    }
  }
}
