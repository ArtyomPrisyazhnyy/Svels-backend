import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('guest_addresses')
@Index('IDX_guest_addresses_user_restaurant', ['userId', 'restaurantId'])
@Index('UQ_guest_addresses_default', ['userId', 'restaurantId'], {
  unique: true,
  where: '"isDefault" = true AND "deletedAt" IS NULL',
})
export class GuestAddress {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'varchar', length: 40, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 120 })
  street: string;

  @Column({ type: 'varchar', length: 20 })
  house: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  apartment: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  entrance: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  floor: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  intercom: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  comment: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  lat: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  lng: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
