import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';

export class QuotePreOrderItemDto {
  @IsUuidV7()
  menuItemId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsOptional()
  @IsObject()
  modifierSelections?: Record<string, string[]>;
}

export class QuotePreOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotePreOrderItemDto)
  items: QuotePreOrderItemDto[];
}
