import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
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
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { DeliveryAddressDto } from './pre-order.dto';

export class CreatePreOrderItemDto {
  @IsUuidV7()
  menuItemId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsOptional()
  @IsObject()
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
  @IsISO8601()
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
