import { Module } from '@nestjs/common';
import {
  GUEST_APPLE_ID_TOKEN_VERIFIER,
  GUEST_APPLE_JWKS_RESOLVER,
  GUEST_GOOGLE_ID_TOKEN_VERIFIER,
} from '../../common/constants/injection-tokens';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../auth.module';
import { createAppleRemoteJwksResolver } from './apple-jwks.resolver';
import { GuestOAuthIdentity } from './entities/guest-oauth-identity.entity';
import { GuestAppleIdTokenVerifier } from './guest-apple-id-token.verifier';
import { GuestGoogleIdTokenVerifier } from './guest-google-id-token.verifier';
import { GuestOAuthService } from './guest-oauth.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([GuestOAuthIdentity]),
    UsersModule,
    AuthModule,
  ],
  providers: [
    GuestOAuthService,
    GuestGoogleIdTokenVerifier,
    GuestAppleIdTokenVerifier,
    {
      provide: GUEST_APPLE_JWKS_RESOLVER,
      useFactory: () => createAppleRemoteJwksResolver(),
    },
    {
      provide: GUEST_GOOGLE_ID_TOKEN_VERIFIER,
      useExisting: GuestGoogleIdTokenVerifier,
    },
    {
      provide: GUEST_APPLE_ID_TOKEN_VERIFIER,
      useExisting: GuestAppleIdTokenVerifier,
    },
  ],
  exports: [GuestOAuthService],
})
export class GuestOAuthModule {}
