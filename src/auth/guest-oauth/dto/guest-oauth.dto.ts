import { IsOptional, IsString, MinLength } from 'class-validator';

export class GuestOAuthGoogleDto {
  @IsString()
  @MinLength(1)
  idToken: string;
}

export class GuestOAuthAppleDto {
  @IsString()
  @MinLength(1)
  idToken: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;
}
