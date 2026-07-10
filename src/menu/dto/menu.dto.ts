import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';
import { ModifierSelectionType } from '../../common/enums/modifier-selection-type.enum';

export class CreateMenuCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class MenuItemNutritionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  calories?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  protein?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carbs?: number;
}

export class MenuModifierOptionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsNumber()
  priceDelta?: number;
}

export class MenuModifierGroupDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(ModifierSelectionType)
  selectionType: ModifierSelectionType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MenuModifierOptionDto)
  options: MenuModifierOptionDto[];
}

export class CreateMenuItemDto {
  @IsUuidV7()
  categoryId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  variantLabel?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MenuItemNutritionDto)
  nutrition?: MenuItemNutritionDto;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsString()
  @MinLength(1)
  imageUrl: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  galleryUrls?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuModifierGroupDto)
  modifierGroups?: MenuModifierGroupDto[];
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsUuidV7()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  variantLabel?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MenuItemNutritionDto)
  nutrition?: MenuItemNutritionDto | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  galleryUrls?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuModifierGroupDto)
  modifierGroups?: MenuModifierGroupDto[];
}
