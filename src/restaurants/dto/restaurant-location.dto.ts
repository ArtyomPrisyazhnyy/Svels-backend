import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRestaurantLocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateRestaurantLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class GeocodeQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  q: string;
}

export class RestaurantLocationResponseDto {
  id: string;
  restaurantId: string;
  city: string;
  address: string;
  label: string | null;
  lat: number;
  lng: number;
  sortOrder: number;
}
