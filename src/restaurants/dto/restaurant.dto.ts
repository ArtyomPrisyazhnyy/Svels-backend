import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';

export class RestaurantLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  city?: string;

  @IsString()
  @MinLength(5)
  address: string;
}

export class CreateRestaurantDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(5)
  address: string;
}

export class RegisterRestaurantDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @Matches(/^\d{9}$/, { message: 'УНП должен содержать 9 цифр' })
  unp: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  isChain: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RestaurantLocationDto)
  locations: RestaurantLocationDto[];
}

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  address?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i, {
    message: 'Некорректный домен',
  })
  customDomain?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  logoWebpUrl?: string | null;
}

export class ReviewRegistrationDto {
  @IsUuidV7()
  requestId: string;

  @IsString()
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
