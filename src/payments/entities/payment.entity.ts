import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentStatus } from '../../common/enums/payment-status.enum';

@Entity('payments')
export class Payment {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'uuid' })
  preOrderId: string;

  @ManyToOne('PreOrder', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'preOrderId' })
  preOrder?: unknown;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32, default: 'bepaid' })
  provider: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  /** Сумма в BYN (как в заказе). */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  /** Сумма в минимальных единицах (копейки) для bePaid. */
  @Column({ type: 'int' })
  amountMinor: number;

  @Column({ type: 'varchar', length: 3, default: 'BYN' })
  currency: string;

  @Column({ type: 'varchar', length: 255 })
  trackingId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  checkoutToken: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  redirectUrl: string | null;

  /** UID authorization/payment в bePaid. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  bepaidUid: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  parentUid: string | null;

  @Column({ type: 'boolean', default: true })
  test: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  transactionType: string | null;

  @Column({ type: 'text', nullable: true })
  lastMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  lastPayload: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
