import type { EntityManager } from 'typeorm';
import { AuthProvider } from '../../common/enums/auth-provider.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateGuestUserDto } from '../dto/create-guest-user.dto';
import { CreateOAuthGuestUserDto } from '../dto/create-oauth-guest-user.dto';
import { CreateRestaurantOwnerDto } from '../dto/create-restaurant-owner.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';

export interface GoogleProfileInput {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PlatformAuthUserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  googleId: string | null;
  restaurantId: string | null;
}

export interface JwtValidationUserRecord {
  id: string;
  email: string;
  role: UserRole;
  restaurantId: string | null;
  passwordChangedAt: Date | null;
}

export type PasswordSecurityReason =
  | 'self_service'
  | 'set_password'
  | 'logout_all';

export interface PasswordSecurityAudit {
  reason: PasswordSecurityReason;
  clientIp?: string;
}

export interface GuestAuthUserRecord {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  restaurantId: string | null;
}

export interface IUsersService {
  create(dto: CreateUserDto, passwordHash: string): Promise<UserResponseDto>;
  createGuest(
    dto: CreateGuestUserDto,
    restaurantId: string,
  ): Promise<UserResponseDto>;
  createOAuthGuest(
    dto: CreateOAuthGuestUserDto,
    restaurantId: string,
  ): Promise<UserResponseDto>;
  createTelegramGuest(
    dto: { telegramUserId: string; firstName: string; lastName: string },
    restaurantId: string,
  ): Promise<UserResponseDto>;
  createRestaurantOwner(
    dto: CreateRestaurantOwnerDto,
  ): Promise<UserResponseDto>;
  createRestaurantOwnerInTransaction(
    manager: EntityManager,
    dto: CreateRestaurantOwnerDto,
  ): Promise<UserResponseDto>;
  bindRestaurant(ownerId: string, restaurantId: string): Promise<void>;
  bindRestaurantInTransaction(
    manager: EntityManager,
    ownerId: string,
    restaurantId: string,
  ): Promise<void>;
  findEmailsByUserIds(userIds: string[]): Promise<Map<string, string>>;
  findByEmail(email: string): Promise<PlatformAuthUserRecord | null>;
  findPlatformUserByEmail(
    email: string,
  ): Promise<PlatformAuthUserRecord | null>;
  findGuestByPhoneAndRestaurant(
    phone: string,
    restaurantId: string,
  ): Promise<GuestAuthUserRecord | null>;
  findGuestByEmailAndRestaurant(
    email: string,
    restaurantId: string,
  ): Promise<GuestAuthUserRecord | null>;
  findByGoogleId(googleId: string): Promise<UserResponseDto | null>;
  findById(id: string): Promise<UserResponseDto | null>;
  findForJwtValidation(id: string): Promise<JwtValidationUserRecord | null>;
  findOrCreateFromGoogle(profile: GoogleProfileInput): Promise<UserResponseDto>;
  updateProfile(
    id: string,
    firstName?: string,
    lastName?: string,
  ): Promise<UserResponseDto>;
  updatePassword(
    id: string,
    password: string,
    audit?: PasswordSecurityAudit,
  ): Promise<UserResponseDto>;
  invalidateAllSessions(
    id: string,
    audit: PasswordSecurityAudit,
  ): Promise<UserResponseDto>;
  deleteAccount(id: string): Promise<void>;
}
