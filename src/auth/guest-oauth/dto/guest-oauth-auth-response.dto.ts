import { AuthResponseDto } from '../../dto/auth-response.dto';

export class GuestOAuthAuthResponseDto extends AuthResponseDto {
  isNew: boolean;
  needsPhone: boolean;
}

export class GuestOAuthProvidersResponseDto {
  google: {
    enabled: boolean;
    clientId: string | null;
  };
  apple: {
    enabled: boolean;
    serviceId: string | null;
    redirectUri: string | null;
  };
}
