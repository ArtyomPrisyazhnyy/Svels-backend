import type { AuthResponseDto } from '../../auth/dto/auth-response.dto';
import type { OtpDeliveryChannel } from '../types/otp.types';

export class GuestOtpSendResponseDto {
  maskedPhone: string;
  channel: OtpDeliveryChannel;
  resendAvailableAt: string;
  expiresAt: string;
}

export interface GuestOtpVerifyAuthResponseDto {
  status: 'authenticated';
  accessToken: string;
  user: AuthResponseDto['user'];
}

export interface GuestOtpVerifyRegistrationResponseDto {
  status: 'registration_required';
  registrationToken: string;
  maskedPhone: string;
}

export type GuestOtpVerifyResponseDto =
  | GuestOtpVerifyAuthResponseDto
  | GuestOtpVerifyRegistrationResponseDto;
