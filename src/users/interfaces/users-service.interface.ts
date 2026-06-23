import { AuthProvider } from '../../common/enums/auth-provider.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';

export interface GoogleProfileInput {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface IUsersService {
  create(dto: CreateUserDto, passwordHash: string): Promise<UserResponseDto>;
  findByEmail(
    email: string,
  ): Promise<{
    id: string;
    email: string;
    passwordHash: string | null;
    role: UserRole;
    authProvider: AuthProvider;
    googleId: string | null;
  } | null>;
  findByGoogleId(googleId: string): Promise<UserResponseDto | null>;
  findById(id: string): Promise<UserResponseDto | null>;
  findOrCreateFromGoogle(profile: GoogleProfileInput): Promise<UserResponseDto>;
  updateProfile(id: string, firstName?: string, lastName?: string): Promise<UserResponseDto>;
}
