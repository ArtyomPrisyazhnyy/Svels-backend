export interface TelegramSendResult {
  ok: boolean;
  requestId?: string;
  /** true если номер точно не может принять код в Telegram */
  unavailable?: boolean;
  error?: string;
}

export interface TelegramDeliveryPollResult {
  delivered: boolean;
  status?: string;
}

export interface ITelegramOtpProvider {
  /**
   * Пытается отправить код через Telegram Gateway.
   * Возвращает ok=false без броска, если номер без Telegram / ошибка API.
   */
  sendCode(phoneE164: string, code: string): Promise<TelegramSendResult>;

  /** Поллит delivery_status до waitMs. */
  waitForDelivery(
    requestId: string,
    waitMs: number,
  ): Promise<TelegramDeliveryPollResult>;

  /** Сообщает Gateway об успешной проверке кода (для статистики). */
  reportCodeChecked(requestId: string, code: string): Promise<void>;
}
