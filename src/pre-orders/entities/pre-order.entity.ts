import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';

@Entity('pre_orders')
export class PreOrder {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne('User', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userId' })
  user?: unknown;

  @Column({ type: 'uuid', nullable: true })
  bookingId: string | null;

  @ManyToOne('Booking', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'bookingId' })
  booking?: unknown;

  @Column({ type: 'enum', enum: PreOrderStatus, default: PreOrderStatus.PENDING })
  status: PreOrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  /** Комментарий к заказу (длинный текст — тип Postgres `text`). */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
