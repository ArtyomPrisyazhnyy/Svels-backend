import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';
import type { PaymentResponseDto } from '../../payments/dto/payment.dto';

export class PreOrderItemDto {
  @IsUuidV7()
  menuItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  /** Цена позиции с учётом модификаторов (из корзины). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
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

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  customerPhone?: string;
}

export class PreOrderItemResponseDto {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export class PreOrderResponseDto {
  id: string;
  restaurantId: string;
  userId: string;
  bookingId: string | null;
  status: PreOrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  comment: string | null;
  items: PreOrderItemResponseDto[];
  payment: PaymentResponseDto | null;
  paymentRedirectUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
