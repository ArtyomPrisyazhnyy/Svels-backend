import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ImageVariantDto {
  @IsInt()
  @Min(1)
  width: number;

  @IsString()
  @MinLength(1)
  webp: string;

  @IsString()
  @MinLength(1)
  jpg: string;
}

export class ImageVariantsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageVariantDto)
  sm?: ImageVariantDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageVariantDto)
  md?: ImageVariantDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageVariantDto)
  lg?: ImageVariantDto;
}
