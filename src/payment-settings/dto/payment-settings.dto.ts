import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class PaymentSettingsResponseDto {
  restaurantId: string;
  enabled: boolean;
  shopId: string | null;
  /** true если секрет задан (сам ключ наружу не отдаём). */
  secretKeyConfigured: boolean;
  testMode: boolean;
  checkoutTransactionType: 'authorization' | 'payment';
  autoCapture: boolean;
  currency: string;
  updatedAt: Date;
}

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === '') {
      return null;
    }
    return typeof value === 'string' ? value.trim() : value;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  shopId?: string | null;

  /** Новый Secret Key. Пустая строка / omit — не менять. */
  @IsOptional()
  @ValidateIf(
    (_, value) => typeof value === 'string' && value.trim().length > 0,
  )
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  secretKey?: string;

  @IsOptional()
  @IsBoolean()
  clearSecretKey?: boolean;

  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @IsOptional()
  @IsIn(['authorization', 'payment'])
  checkoutTransactionType?: 'authorization' | 'payment';

  @IsOptional()
  @IsBoolean()
  autoCapture?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}

/** Расшифрованные credentials для вызовов bePaid API. */
export interface RestaurantBePaidCredentials {
  restaurantId: string;
  shopId: string;
  secretKey: string;
  testMode: boolean;
  checkoutTransactionType: 'authorization' | 'payment';
  autoCapture: boolean;
  currency: string;
}
