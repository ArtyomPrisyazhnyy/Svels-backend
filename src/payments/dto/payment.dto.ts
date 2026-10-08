import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentStatus } from '../../common/enums/payment-status.enum';

export class PaymentResponseDto {
  id: string;
  restaurantId: string;
  preOrderId: string;
  status: PaymentStatus;
  amount: number;
  amountMinor: number;
  currency: string;
  trackingId: string;
  redirectUrl: string | null;
  checkoutToken: string | null;
  bepaidUid: string | null;
  test: boolean;
  transactionType: string | null;
  lastMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateCheckoutResponseDto {
  preOrderId: string;
  payment: PaymentResponseDto;
  /** URL страницы оплаты bePaid (или null для cash/card). */
  paymentRedirectUrl: string | null;
}

export class CapturePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class VoidPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
