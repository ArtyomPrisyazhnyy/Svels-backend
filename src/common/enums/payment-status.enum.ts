export enum PaymentStatus {
  /** Создан checkout, ждём оплату в bePaid. */
  PENDING = 'pending',
  /** Средства захолдированы (authorization). */
  AUTHORIZED = 'authorized',
  /** Средства списаны (capture или payment). */
  CAPTURED = 'captured',
  /** Холд отменён (void). */
  VOIDED = 'voided',
  FAILED = 'failed',
  EXPIRED = 'expired',
}
