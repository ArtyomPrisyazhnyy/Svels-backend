import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PromoBannerAspectRatio,
  PromoBannerDisplayFrequency,
  PromoBannerType,
} from '../../common/enums/promo-banner.enum';

export class CreatePromoBannerDto {
  @IsEnum(PromoBannerType)
  type: PromoBannerType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  imageUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageWebpUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  linkUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** Только для type=modal. Для strip сохраняется every_visit. */
  @IsOptional()
  @IsEnum(PromoBannerDisplayFrequency)
  displayFrequency?: PromoBannerDisplayFrequency;

  /** Только для type=strip. Для modal сохраняется 4:1. */
  @IsOptional()
  @IsEnum(PromoBannerAspectRatio)
  aspectRatio?: PromoBannerAspectRatio;
}

export class UpdatePromoBannerDto {
  @IsOptional()
  @IsEnum(PromoBannerType)
  type?: PromoBannerType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageWebpUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  linkUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(PromoBannerDisplayFrequency)
  displayFrequency?: PromoBannerDisplayFrequency;

  @IsOptional()
  @IsEnum(PromoBannerAspectRatio)
  aspectRatio?: PromoBannerAspectRatio;
}

export class PromoBannerResponseDto {
  id: string;
  restaurantId: string;
  type: PromoBannerType;
  title: string | null;
  imageUrl: string;
  imageWebpUrl: string | null;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  displayFrequency: PromoBannerDisplayFrequency;
  aspectRatio: PromoBannerAspectRatio;
  createdAt: Date;
  updatedAt: Date;
}
