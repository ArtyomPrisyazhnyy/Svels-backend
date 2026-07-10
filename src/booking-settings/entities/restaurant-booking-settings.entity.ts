import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingMode } from '../../common/enums/booking-mode.enum';
import { DepositScheme } from '../../common/enums/deposit-scheme.enum';

@Entity('restaurant_booking_settings')
export class RestaurantBookingSettings {
  @PrimaryColumn('uuid')
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ default: false })
  bookingEnabled: boolean;

  @Column({
    type: 'enum',
    enum: BookingMode,
    default: BookingMode.SPECIFIC_TABLE,
  })
  mode: BookingMode;

  @Column({
    type: 'enum',
    enum: DepositScheme,
    default: DepositScheme.NO_DEPOSIT,
  })
  depositScheme: DepositScheme;

  /** Глобальная сумма депозита BYN при `DepositScheme.GLOBAL_DEPOSIT`. */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  depositAmount: number;

  /** Длительность одной брони в минутах (окно занятости стола). */
  @Column({ type: 'int', default: 120 })
  bookingDurationMinutes: number;

  /** Шаг слота в минутах (15/30/60/90...). */
  @Column({ type: 'int', default: 30 })
  slotMinutes: number;

  /** Максимальное количество гостей на одно бронирование. */
  @Column({ type: 'int', default: 8 })
  maxGuests: number;

  /** На сколько дней вперёд доступно бронирование. */
  @Column({ type: 'int', default: 14 })
  advanceDays: number;

  /** Автоматически подтверждать бронирования (иначе ждут ручного подтверждения). */
  @Column({ default: false })
  autoConfirm: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
