export enum DepositScheme {
  /** Депозит не требуется. */
  NO_DEPOSIT = 'no_deposit',
  /** Фиксированный депозит на всё заведение. */
  GLOBAL_DEPOSIT = 'global_deposit',
  /** Депозит зависит от зоны (зала). */
  PER_ZONE = 'per_zone',
  /** Индивидуальный депозит для каждого стола. */
  PER_TABLE = 'per_table',
}
