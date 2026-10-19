import type { ConfigService } from '@nestjs/config';
import type { GuestOAuthProvidersResponseDto } from './dto/guest-oauth-auth-response.dto';

export function buildGuestOAuthProvidersResponse(
  configService: ConfigService,
): GuestOAuthProvidersResponseDto {
  const googleClientIds =
    configService.get<string[]>('guestOAuth.googleClientIds') ?? [];
  const appleServiceId =
    configService.get<string>('guestOAuth.appleServiceId') ?? '';
  const appleTeamId = configService.get<string>('guestOAuth.appleTeamId') ?? '';
  const appleRedirectUri =
    configService.get<string>('guestOAuth.appleRedirectUri') ?? '';

  return {
    google: {
      enabled: googleClientIds.length > 0,
      clientId: googleClientIds[0] ?? null,
    },
    apple: {
      enabled: Boolean(appleServiceId && appleTeamId && appleRedirectUri),
      serviceId: appleServiceId || null,
      redirectUri: appleRedirectUri || null,
    },
  };
}
