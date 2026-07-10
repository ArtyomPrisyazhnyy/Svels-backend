import { AuthProvider } from '../../common/enums/auth-provider.enum';
import { UserRole } from '../../common/enums/user-role.enum';

export class AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    authProvider: AuthProvider;
    restaurantId?: string;
  };
}
