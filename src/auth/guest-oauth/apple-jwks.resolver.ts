import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

export const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');

/** Default JWKS fetch timeout for Apple (ms). */
export const GUEST_OAUTH_REMOTE_FETCH_TIMEOUT_MS = 5000;

export type GuestAppleJwksResolverFn = () => JWTVerifyGetKey;

export function createAppleRemoteJwksResolver(
  url: URL = APPLE_JWKS_URL,
  timeoutDurationMs = GUEST_OAUTH_REMOTE_FETCH_TIMEOUT_MS,
): GuestAppleJwksResolverFn {
  return () =>
    createRemoteJWKSet(url, {
      timeoutDuration: timeoutDurationMs,
    });
}
