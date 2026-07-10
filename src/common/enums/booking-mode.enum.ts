export enum BookingMode {
  /** Гость выбирает конкретный стол на планировке. */
  SPECIFIC_TABLE = 'specific_table',
  /** Гость бронирует «стол на N мест», стол назначает заведение. */
  BY_SEATS = 'by_seats',
}
