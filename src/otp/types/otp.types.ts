export type OtpDeliveryChannel = 'telegram' | 'sms' | 'dev';

export interface GuestOtpRecord {
  codeHash: string;
  phone: string;
  restaurantId: string;
  channel: OtpDeliveryChannel;
  createdAt: string;
  resendAvailableAt: string;
  expiresAt: string;
  verifyAttempts: number;
  sendCount: number;
  telegramRequestId?: string;
  country: 'BY' | 'RU';
}

export interface OtpSendResult {
  maskedPhone: string;
  channel: OtpDeliveryChannel;
  resendAvailableAt: string;
  expiresAt: string;
}
