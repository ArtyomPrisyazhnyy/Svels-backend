import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const jwtVerify = jest.fn();

jest.mock('jose', () => ({
  jwtVerify,
  createRemoteJWKSet: jest.fn(),
}));

import type { JWTVerifyGetKey } from 'jose';
import { GuestAppleIdTokenVerifier } from './guest-apple-id-token.verifier';

describe('GuestAppleIdTokenVerifier', () => {
  let verifier: GuestAppleIdTokenVerifier;
  const mockJwks: JWTVerifyGetKey = jest.fn();

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'guestOAuth.appleServiceId') {
        return 'com.example.service';
      }
      if (key === 'guestOAuth.appleTeamId') {
        return 'TEAM123';
      }
      if (key === 'guestOAuth.appleRedirectUri') {
        return 'https://app.example/auth/apple/callback';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jwtVerify.mockReset();
    verifier = new GuestAppleIdTokenVerifier(configService, () => mockJwks);
  });

  it('rejects when Apple OAuth is not configured', async () => {
    const disabledConfig = {
      get: jest.fn(() => ''),
    } as unknown as ConfigService;
    const disabled = new GuestAppleIdTokenVerifier(
      disabledConfig,
      () => mockJwks,
    );

    await expect(disabled.verify('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects expired token', async () => {
    jwtVerify.mockRejectedValue(
      new Error('"exp" claim timestamp check failed'),
    );

    await expect(verifier.verify('token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects wrong issuer', async () => {
    jwtVerify.mockRejectedValue(new Error('unexpected "iss" claim value'));

    await expect(verifier.verify('token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects wrong audience', async () => {
    jwtVerify.mockRejectedValue(new Error('unexpected "aud" claim value'));

    await expect(verifier.verify('token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns profile for a valid token', async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: 'apple-sub',
        email: 'hide@privaterelay.appleid.com',
      },
    });

    await expect(verifier.verify('token')).resolves.toEqual({
      subject: 'apple-sub',
      email: 'hide@privaterelay.appleid.com',
      firstName: 'User',
      lastName: '',
    });

    expect(jwtVerify).toHaveBeenCalledWith('token', mockJwks, {
      issuer: 'https://appleid.apple.com',
      audience: 'com.example.service',
    });
  });
});
