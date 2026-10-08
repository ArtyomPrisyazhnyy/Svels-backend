import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';
import { FulfillmentType } from '../../common/enums/fulfillment-type.enum';
import { OrderPaymentStatus } from '../../common/enums/order-payment-status.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';
import type { PaymentResponseDto } from '../../payments/dto/payment.dto';
import type { PreOrderItemModifierSnapshot } from '../types/pre-order-item-modifier.types';

export class DeliveryAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  street: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  house: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  intercom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  comment?: string;
}

export class CreatePreOrderItemDto {
  @IsUuidV7()
  menuItemId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsOptional()
  modifierSelections?: Record<string, string[]>;

  /** Устарело: игнорируется сервером (цена из меню). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  /** Устарело: игнорируется сервером (название из меню). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class CreatePreOrderDto {
  @IsEnum(FulfillmentType)
  fulfillmentType: FulfillmentType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePreOrderItemDto)
  items: CreatePreOrderItemDto[];

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  customerName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  customerPhone: string;

  @IsOptional()
  @IsUuidV7()
  locationId?: string;

  @ValidateIf(
    (o: CreatePreOrderDto) => o.fulfillmentType === FulfillmentType.DELIVERY,
  )
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;

  @IsOptional()
  requestedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsUuidV7()
  bookingId?: string;
}

export class OrderItemDto {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: PreOrderItemModifierSnapshot[];
  lineTotal: number;
}

export class OrderDto {
  id: string;
  restaurantId: string;
  orderNumber: number;
  status: PreOrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: OrderPaymentStatus;
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryAddress: DeliveryAddressDto | null;
  locationId: string | null;
  requestedAt: string | null;
  comment: string | null;
  cancelReason: string | null;
  totalAmount: number;
  items: OrderItemDto[];
  bookingId: string | null;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
}

export class PreOrderResponseDto extends OrderDto {
  payment: PaymentResponseDto | null;
  paymentRedirectUrl: string | null;
}
