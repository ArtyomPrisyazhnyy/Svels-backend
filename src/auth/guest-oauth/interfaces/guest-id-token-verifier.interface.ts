import type { VerifiedGuestOAuthProfile } from './verified-guest-oauth-profile.interface';

export interface IGuestGoogleIdTokenVerifier {
  verify(idToken: string): Promise<VerifiedGuestOAuthProfile>;
}

export interface IGuestAppleIdTokenVerifier {
  verify(idToken: string): Promise<VerifiedGuestOAuthProfile>;
}
