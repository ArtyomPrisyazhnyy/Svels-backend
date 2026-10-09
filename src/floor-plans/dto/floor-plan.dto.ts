import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { SeatKind } from '../../common/enums/seat-kind.enum';
import { TableObjectType } from '../../common/enums/table-object-type.enum';
import { TableShape } from '../../common/enums/table-shape.enum';
import type { DecorLayoutData } from '../entities/decor-layout-data.type';
import { IsValidDecorLayoutData } from './decor-validators';

/** Посадочное место стола (стул/диван/скамейка/табурет). */
export class SeatDto {
  @IsString()
  id: string;

  @IsEnum(SeatKind)
  kind: SeatKind;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(359)
  rotation?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  width?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  slots?: number;
}

export class CreateFloorPlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @Validate(IsValidDecorLayoutData)
  decorData?: DecorLayoutData;
}

export class UpdateFloorPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @Validate(IsValidDecorLayoutData)
  decorData?: DecorLayoutData;
}

/** Описание одного стола в bulk-сохранении планировки. */
export class LayoutTableDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;

  @IsOptional()
  @IsEnum(TableObjectType)
  objectType?: TableObjectType;

  @IsOptional()
  @IsEnum(TableShape)
  shape?: TableShape;

  @IsInt()
  @Min(1)
  @Max(50)
  capacity: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  minCapacity?: number;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  height?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  points?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats?: SeatDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cornerRadius?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(359)
  rotation?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleToGuests?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/** Payload bulk-сохранения всей планировки зоны одним запросом (atomic). */
export class SaveLayoutDto {
  @IsOptional()
  @Validate(IsValidDecorLayoutData)
  decorData?: DecorLayoutData;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LayoutTableDto)
  tables: LayoutTableDto[] = [];
}

export class CreateTableDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;

  @IsOptional()
  @IsEnum(TableObjectType)
  objectType?: TableObjectType;

  @IsInt()
  @Min(1)
  @Max(50)
  capacity: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  minCapacity?: number;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  height?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  points?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats?: SeatDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cornerRadius?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(359)
  rotation?: number;

  @IsOptional()
  @IsEnum(TableShape)
  shape?: TableShape;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleToGuests?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsEnum(TableObjectType)
  objectType?: TableObjectType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  minCapacity?: number;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  height?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  points?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats?: SeatDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cornerRadius?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(359)
  rotation?: number;

  @IsOptional()
  @IsEnum(TableShape)
  shape?: TableShape;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleToGuests?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
