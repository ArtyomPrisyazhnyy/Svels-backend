import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';
import { DeliveryZoneType } from '../enums/delivery-zone-type.enum';
import type { GeoJsonPolygon } from '../types/geojson-polygon.type';

export class GeoJsonPolygonDto {
  @IsString()
  type: 'Polygon';

  @IsOptional()
  coordinates?: number[][][];
}

export class CreateDeliveryZoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsEnum(DeliveryZoneType)
  type: DeliveryZoneType;

  @ValidateIf((o: CreateDeliveryZoneDto) => o.type === DeliveryZoneType.RADIUS)
  @IsInt()
  @Min(1)
  @Max(100_000)
  radiusMeters?: number;

  @ValidateIf((o: CreateDeliveryZoneDto) => o.type === DeliveryZoneType.POLYGON)
  @IsObject()
  polygon?: GeoJsonPolygon;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryFee: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrder: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  freeDeliveryFrom?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  priority?: number;
}

export class UpdateDeliveryZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(DeliveryZoneType)
  type?: DeliveryZoneType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  radiusMeters?: number | null;

  @IsOptional()
  @IsObject()
  polygon?: GeoJsonPolygon | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  freeDeliveryFrom?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  priority?: number;
}

export class DeliveryZoneResponseDto {
  id: string;
  locationId: string;
  name: string;
  type: DeliveryZoneType;
  radiusMeters: number | null;
  polygon: GeoJsonPolygon | null;
  deliveryFee: number;
  minOrder: number;
  freeDeliveryFrom: number | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export class DeliveryQuoteQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsUuidV7()
  locationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;
}

export class DeliveryQuoteZoneDto {
  id: string;
  locationId: string;
  name: string;
  deliveryFee: number;
  minOrder: number;
  freeDeliveryFrom: number | null;
}

export class DeliveryQuoteResponseDto {
  status: 'in_zone' | 'out_of_zone';
  zone: DeliveryQuoteZoneDto | null;
  deliveryFee: number | null;
  minOrder: number | null;
  freeDeliveryFrom: number | null;
}
