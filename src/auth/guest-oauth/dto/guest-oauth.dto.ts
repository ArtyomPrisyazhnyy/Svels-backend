import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** POST body for guest Google sign-in (id_token from GIS). */
export class GuestOAuthGoogleDto {
  @IsString()
  @MinLength(10)
  @MaxLength(8192)
  idToken: string;
}

/** POST body for guest Apple sign-in (id_token from Apple JS). */
export class GuestOAuthAppleDto {
  @IsString()
  @MinLength(10)
  @MaxLength(8192)
  idToken: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName?: string;
}
