import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class GoogleTokenService {
  private readonly logger = new Logger(GoogleTokenService.name);
  private readonly client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('google.clientId');
    const clientSecret = this.configService.get<string>('google.clientSecret');

    this.client = new OAuth2Client({
      clientId,
      clientSecret: clientSecret || undefined,
    });
  }

  async verifyIdToken(idToken: string): Promise<GoogleUserProfile> {
    const clientId = this.configService.get<string>('google.clientId');
    if (!clientId) {
      throw new UnauthorizedException('Google OAuth не настроен');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Некорректный Google токен');
      }

      if (!payload.email_verified) {
        throw new UnauthorizedException('Email Google не подтверждён');
      }

      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        firstName: payload.given_name ?? payload.name?.split(' ')[0] ?? 'User',
        lastName: payload.family_name ?? payload.name?.split(' ').slice(1).join(' ') ?? '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const details = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Google token verification failed: ${details}`);

      const isDev = this.configService.get<string>('nodeEnv') === 'development';
      throw new UnauthorizedException(
        isDev
          ? `Не удалось проверить Google токен: ${details}`
          : 'Не удалось проверить Google токен',
      );
    }
  }
}
