import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GUEST_APPLE_ID_TOKEN_VERIFIER,
  GUEST_GOOGLE_ID_TOKEN_VERIFIER,
  USERS_SERVICE,
} from '../../common/constants/injection-tokens';
import { AuthService } from '../auth.service';
import { UserCreatedEvent } from '../../users/events/user-created.event';
import type { IUsersService } from '../../users/interfaces/users-service.interface';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import type { VerifiedGuestOAuthProfile } from './interfaces/verified-guest-oauth-profile.interface';
import type {
  IGuestAppleIdTokenVerifier,
  IGuestGoogleIdTokenVerifier,
} from './interfaces/guest-id-token-verifier.interface';
import { GuestOAuthProvider } from './enums/guest-oauth-provider.enum';
import { GuestOAuthIdentity } from './entities/guest-oauth-identity.entity';
import {
  GuestOAuthAuthResponseDto,
  GuestOAuthProvidersResponseDto,
} from './dto/guest-oauth-auth-response.dto';
import { GuestGoogleIdTokenVerifier } from './guest-google-id-token.verifier';
import { GuestAppleIdTokenVerifier } from './guest-apple-id-token.verifier';

@Injectable()
export class GuestOAuthService {
  constructor(
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(GuestOAuthIdentity)
    private readonly identityRepository: Repository<GuestOAuthIdentity>,
    @Inject(GUEST_GOOGLE_ID_TOKEN_VERIFIER)
    private readonly googleVerifier: IGuestGoogleIdTokenVerifier,
    @Inject(GUEST_APPLE_ID_TOKEN_VERIFIER)
    private readonly appleVerifier: IGuestAppleIdTokenVerifier,
    private readonly googleVerifierMeta: GuestGoogleIdTokenVerifier,
    private readonly appleVerifierMeta: GuestAppleIdTokenVerifier,
  ) {}

  getProviders(): GuestOAuthProvidersResponseDto {
    return {
      google: {
        enabled: this.googleVerifierMeta.isEnabled(),
        clientId: this.googleVerifierMeta.getPrimaryClientId(),
      },
      apple: {
        enabled: this.appleVerifierMeta.isEnabled(),
        serviceId: this.appleVerifierMeta.getServiceIdForClient(),
        redirectUri: this.appleVerifierMeta.getRedirectUriForClient(),
      },
    };
  }

  async signInWithGoogle(
    restaurantId: string,
    idToken: string,
  ): Promise<GuestOAuthAuthResponseDto> {
    const profile = await this.googleVerifier.verify(idToken);
    return this.resolveGuestSession(
      restaurantId,
      GuestOAuthProvider.GOOGLE,
      profile,
    );
  }

  async signInWithApple(
    restaurantId: string,
    idToken: string,
    name?: { firstName?: string; lastName?: string },
  ): Promise<GuestOAuthAuthResponseDto> {
    const profile = await this.appleVerifier.verify(idToken);
    const merged: VerifiedGuestOAuthProfile = {
      ...profile,
      firstName: name?.firstName?.trim() || profile.firstName,
      lastName: name?.lastName?.trim() || profile.lastName,
    };
    return this.resolveGuestSession(
      restaurantId,
      GuestOAuthProvider.APPLE,
      merged,
    );
  }

  private async resolveGuestSession(
    restaurantId: string,
    provider: GuestOAuthProvider,
    profile: VerifiedGuestOAuthProfile,
  ): Promise<GuestOAuthAuthResponseDto> {
    const existingIdentity = await this.identityRepository.findOne({
      where: {
        restaurantId,
        provider,
        providerSubject: profile.subject,
      },
    });

    if (existingIdentity) {
      const user = await this.usersService.findById(existingIdentity.userId);
      if (!user || user.restaurantId !== restaurantId) {
        throw new BadRequestException('Пользователь не найден');
      }
      return this.buildOAuthAuthResponse(user, false);
    }

    const guestByEmail = await this.usersService.findGuestByEmailAndRestaurant(
      profile.email,
      restaurantId,
    );

    let userId: string;
    let isNew = false;

    if (guestByEmail) {
      userId = guestByEmail.id;
      await this.identityRepository.save(
        this.identityRepository.create({
          userId,
          restaurantId,
          provider,
          providerSubject: profile.subject,
          email: profile.email,
        }),
      );
    } else {
      const user = await this.usersService.createOAuthGuest(
        {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
        restaurantId,
      );
      userId = user.id;
      isNew = true;
      await this.identityRepository.save(
        this.identityRepository.create({
          userId,
          restaurantId,
          provider,
          providerSubject: profile.subject,
          email: profile.email,
        }),
      );
      this.eventEmitter.emit(
        'user.created',
        new UserCreatedEvent(user.id, user.email),
      );
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('Пользователь не найден');
    }
    return this.buildOAuthAuthResponse(user, isNew);
  }

  private buildOAuthAuthResponse(
    user: UserResponseDto,
    isNew: boolean,
  ): GuestOAuthAuthResponseDto {
    const auth = this.authService.issueGuestSession(user);
    return {
      ...auth,
      isNew,
      needsPhone: !user.phone,
    };
  }
}
