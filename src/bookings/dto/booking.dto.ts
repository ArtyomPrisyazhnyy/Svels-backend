import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export class CreateBookingDto {
  @IsOptional()
  @IsUuidV7()
  tableId?: string;

  @IsDateString()
  bookingDate: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  bookingTime: string;

  @IsInt()
  @Min(1)
  @Max(50)
  guestCount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;
}
