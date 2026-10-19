import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GuestGoogleIdTokenVerifier } from './guest-google-id-token.verifier';

describe('GuestGoogleIdTokenVerifier', () => {
  let verifier: GuestGoogleIdTokenVerifier;
  let verifyIdToken: jest.Mock;
  let client: OAuth2Client;

  beforeEach(() => {
    verifyIdToken = jest.fn();
    client = {
      verifyIdToken: verifyIdToken,
    } as unknown as OAuth2Client;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'guestOAuth.googleClientIds') {
          return ['client-a', 'client-b'];
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    verifier = new GuestGoogleIdTokenVerifier(configService, client);
  });

  it('rejects when Google OAuth is not configured', async () => {
    const configService = {
      get: jest.fn(() => []),
    } as unknown as ConfigService;
    const disabled = new GuestGoogleIdTokenVerifier(configService, client);

    await expect(disabled.verify('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects unverified email', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub',
        email: 'user@example.com',
        email_verified: false,
      }),
    });

    await expect(verifier.verify('token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects wrong audience / invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('Wrong audience'));

    await expect(verifier.verify('token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns profile for a valid token', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub',
        email: 'User@Example.com',
        email_verified: true,
        given_name: 'Ada',
        family_name: 'Lovelace',
      }),
    });

    await expect(verifier.verify('token')).resolves.toEqual({
      subject: 'google-sub',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'token',
      audience: ['client-a', 'client-b'],
    });
  });
});
