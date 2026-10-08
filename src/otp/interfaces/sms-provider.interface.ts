export interface SmsSendResult {
  ok: boolean;
  provider: 'sms_by' | 'smsc' | 'dev';
  error?: string;
  messageId?: string;
}

export interface ISmsProvider {
  readonly name: 'sms_by' | 'smsc' | 'dev';
  send(phoneE164: string, message: string): Promise<SmsSendResult>;
}
