import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOrderSettingsDto {
  @IsOptional()
  @IsBoolean()
  fulfillmentDelivery?: boolean;

  @IsOptional()
  @IsBoolean()
  fulfillmentTakeaway?: boolean;

  @IsOptional()
  @IsBoolean()
  fulfillmentDineIn?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentCash?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentCardOnSite?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentOnline?: boolean;
}

export class OrderSettingsResponseDto {
  restaurantId: string;
  fulfillmentDelivery: boolean;
  fulfillmentTakeaway: boolean;
  fulfillmentDineIn: boolean;
  paymentCash: boolean;
  paymentCardOnSite: boolean;
  paymentOnline: boolean;
  updatedAt: Date;
}
