import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';

export class UpdateMenuCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class ReorderMenuCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUuidV7({ each: true })
  ids: string[];
}
