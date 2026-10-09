import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RestaurantResponseDto } from './restaurant-response.dto';

export class AdminRestaurantOwnerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class AdminCreateRestaurantDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(5)
  address: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(/^\d{9}$/, { message: 'УНП должен содержать 9 цифр' })
  unp?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i, {
    message: 'Некорректный домен',
  })
  customDomain?: string | null;

  @ValidateNested()
  @Type(() => AdminRestaurantOwnerDto)
  owner: AdminRestaurantOwnerDto;
}

export class AdminRestaurantListItemDto {
  id: string;
  name: string;
  status: string;
  customDomain: string | null;
  ownerEmail: string | null;
  createdAt: string;
}

export class AdminCreateRestaurantResponseDto {
  restaurant: RestaurantResponseDto;
  owner: { id: string; email: string };
  setPasswordUrl: string;
  expiresAt: string;
}

export class OwnerInviteResponseDto {
  setPasswordUrl: string;
  expiresAt: string;
}
