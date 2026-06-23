import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';
import { PaymentMethod } from '../../common/enums/payment-method.enum';

export class PreOrderItemDto {
  @IsUuidV7()
  menuItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreatePreOrderDto {
  @IsOptional()
  @IsUuidV7()
  bookingId?: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreOrderItemDto)
  items: PreOrderItemDto[];
}
