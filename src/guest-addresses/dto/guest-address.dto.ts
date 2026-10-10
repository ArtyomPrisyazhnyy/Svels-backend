import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeliveryAddressDto } from '../../pre-orders/dto/pre-order.dto';

export class GuestAddressDto {
  id: string;
  label: string | null;
  street: string;
  house: string;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  comment: string | null;
  isDefault: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class CreateGuestAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

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

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateGuestAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  street?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  house?: string;

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

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/** Snapshot fields for order integration (no label / isDefault). */
export class GuestAddressSnapshotDto extends DeliveryAddressDto {}

export class SaveGuestAddressFromOrderDto {
  @ValidateNested()
  @Type(() => GuestAddressSnapshotDto)
  snapshot: GuestAddressSnapshotDto;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;
}
