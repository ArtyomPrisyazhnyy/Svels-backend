import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('restaurant_payment_settings')
export class RestaurantPaymentSettings {
  @PrimaryColumn('uuid')
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  /** Онлайн-оплата через bePaid включена (нужны shopId + secret). */
  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  shopId: string | null;

  /** AES-GCM ciphertext (см. encryptSecret). */
  @Column({ type: 'text', nullable: true })
  secretKeyEncrypted: string | null;

  @Column({ default: true })
  testMode: boolean;

  /** authorization = холд; payment = сразу списание. */
  @Column({ type: 'varchar', length: 32, default: 'authorization' })
  checkoutTransactionType: 'authorization' | 'payment';

  /** После холда сразу capture. Для кухни/бара лучше false. */
  @Column({ default: false })
  autoCapture: boolean;

  @Column({ type: 'varchar', length: 3, default: 'BYN' })
  currency: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
