import { AuthProvider } from '../../common/enums/auth-provider.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateGuestUserDto } from '../dto/create-guest-user.dto';
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
  findByEmail(email: string): Promise<PlatformAuthUserRecord | null>;
  findPlatformUserByEmail(
    email: string,
  ): Promise<PlatformAuthUserRecord | null>;
  findGuestByPhoneAndRestaurant(
    phone: string,
    restaurantId: string,
  ): Promise<GuestAuthUserRecord | null>;
  findByGoogleId(googleId: string): Promise<UserResponseDto | null>;
  findById(id: string): Promise<UserResponseDto | null>;
  findOrCreateFromGoogle(profile: GoogleProfileInput): Promise<UserResponseDto>;
  updateProfile(
    id: string,
    firstName?: string,
    lastName?: string,
  ): Promise<UserResponseDto>;
  updatePassword(id: string, password: string): Promise<UserResponseDto>;
  deleteAccount(id: string): Promise<void>;
}
