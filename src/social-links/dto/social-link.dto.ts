import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSocialLinkDto {
  @IsString()
  @MinLength(3)
  url: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSocialLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SocialLinkResponseDto {
  id: string;
  restaurantId: string;
  url: string;
  label: string | null;
  platform: string;
  sortOrder: number;
  createdAt: Date;
}
