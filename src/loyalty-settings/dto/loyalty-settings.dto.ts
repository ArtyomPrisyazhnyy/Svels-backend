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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';
import { LoyaltyRewardType } from '../../common/enums/loyalty.enum';
import type {
  FlameLevelConfig,
  OtherLoyaltyProgramStub,
} from '../loyalty-settings.types';

export class LoyaltyRewardDto {
  @IsOptional()
  @IsUuidV7()
  id?: string;

  @IsEnum(LoyaltyRewardType)
  type: LoyaltyRewardType;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ValidateIf((o: LoyaltyRewardDto) => o.type === LoyaltyRewardType.PERCENT_DISCOUNT)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100)
  percentOff?: number | null;

  @ValidateIf((o: LoyaltyRewardDto) => o.type === LoyaltyRewardType.FIXED_DISCOUNT)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountOff?: number | null;

  @ValidateIf((o: LoyaltyRewardDto) => o.type === LoyaltyRewardType.FREE_MENU_ITEM)
  @IsUuidV7()
  menuItemId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number | null;
}

export class FlameLevelDto {
  @IsOptional()
  @IsUuidV7()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  requiredVisits: number;

  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => LoyaltyRewardDto)
  rewards: LoyaltyRewardDto[];
}

export class UpdateLoyaltySettingsDto {
  @IsOptional()
  @IsBoolean()
  flameDisplayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  flameRewardsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  flameExpireDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FlameLevelDto)
  flameLevels?: FlameLevelDto[];
}

export class LoyaltySettingsResponseDto {
  restaurantId: string;
  flameDisplayEnabled: boolean;
  flameRewardsEnabled: boolean;
  flameExpireDays: number;
  flameLevels: FlameLevelConfig[];
  otherPrograms: OtherLoyaltyProgramStub[];
  updatedAt: Date;
}
