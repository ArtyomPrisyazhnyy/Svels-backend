import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { BookingMode } from '../../common/enums/booking-mode.enum';
import { DepositScheme } from '../../common/enums/deposit-scheme.enum';

export class UpdateBookingSettingsDto {
  @IsOptional()
  @IsBoolean()
  bookingEnabled?: boolean;

  @IsOptional()
  @IsEnum(BookingMode)
  mode?: BookingMode;

  @IsOptional()
  @IsEnum(DepositScheme)
  depositScheme?: DepositScheme;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  bookingDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  slotMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxGuests?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  advanceDays?: number;

  @IsOptional()
  @IsBoolean()
  autoConfirm?: boolean;
}

export class BookingSettingsResponseDto {
  restaurantId: string;
  bookingEnabled: boolean;
  mode: BookingMode;
  depositScheme: DepositScheme;
  depositAmount: number;
  bookingDurationMinutes: number;
  slotMinutes: number;
  maxGuests: number;
  advanceDays: number;
  autoConfirm: boolean;
  updatedAt: Date;
}

/** Тонкий DTO для эндпоинта `PATCH /restaurants/:id/booking-deposit` (панель депозитов конструктора). */
export class SetDepositDto {
  @IsEnum(DepositScheme)
  scheme: DepositScheme;

  @IsNumber()
  @Min(0)
  amount: number;
}
