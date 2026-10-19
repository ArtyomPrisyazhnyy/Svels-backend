import { JwtService } from '@nestjs/jwt';
import type { VerifiedGuestOAuthProfile } from '../../src/auth/guest-oauth/interfaces/verified-guest-oauth-profile.interface';
import type {
  IGuestAppleIdTokenVerifier,
  IGuestGoogleIdTokenVerifier,
} from '../../src/auth/guest-oauth/interfaces/guest-id-token-verifier.interface';

export class E2eGuestGoogleIdTokenVerifier implements IGuestGoogleIdTokenVerifier {
  constructor(private readonly jwtService: JwtService) {}

  verify(idToken: string): Promise<VerifiedGuestOAuthProfile> {
    const payload = this.jwtService.verify<{
      sub: string;
      email: string;
      given_name?: string;
      family_name?: string;
    }>(idToken);

    if (!payload.sub || !payload.email) {
      throw new Error('invalid test token');
    }

    return Promise.resolve({
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      firstName: payload.given_name ?? 'User',
      lastName: payload.family_name ?? '',
    });
  }
}

export class E2eGuestAppleIdTokenVerifier implements IGuestAppleIdTokenVerifier {
  constructor(private readonly jwtService: JwtService) {}

  verify(idToken: string): Promise<VerifiedGuestOAuthProfile> {
    const payload = this.jwtService.verify<{
      sub: string;
      email: string;
    }>(idToken);

    if (!payload.sub || !payload.email) {
      throw new Error('invalid test token');
    }

    return Promise.resolve({
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      firstName: 'User',
      lastName: '',
    });
  }
}
