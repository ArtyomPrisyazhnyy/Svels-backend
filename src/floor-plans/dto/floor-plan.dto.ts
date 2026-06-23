import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFloorPlanDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsObject()
  layoutData?: Record<string, unknown>;
}

export class CreateTableDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
