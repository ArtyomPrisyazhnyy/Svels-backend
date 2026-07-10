import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';

@Entity('bookings')
@Index('idx_bookings_restaurant_date', ['restaurantId', 'bookingDate'])
@Index('idx_bookings_table', ['tableId'])
@Index('idx_bookings_user', ['userId'])
export class Booking {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'uuid', nullable: true })
  tableId: string | null;

  @ManyToOne('Table', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'tableId' })
  table?: unknown;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne('User', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userId' })
  user?: unknown;

  @Column({ type: 'date' })
  bookingDate: string;

  @Column({ type: 'time' })
  bookingTime: string;

  /**
   * Нормализованное начало слота (timestamptz). Вместе с `slotEnd` образует
   * окно занятости стола, проверяемое через EXCLUDE gist-индекс против пересечений.
   */
  @Column({ type: 'timestamptz' })
  slotStart: Date;

  @Column({ type: 'timestamptz' })
  slotEnd: Date;

  @Column({ type: 'int' })
  guestCount: number;

  /** Снимок суммы депозита BYN на момент создания брони (иммутабелен). */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  depositAmount: number;

  /** Optimistic concurrency version (дополнение к пессимистической блокировке). */
  @Column({ type: 'int', default: 0 })
  version: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
