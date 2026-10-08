import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

/**
 * Избранное: либо userId (авторизованный), либо guestId (устройство без логина).
 * Связи с User/MenuItem — только по ID (без FK constraints между модулями).
 */
@Entity('favorites')
@Index('UQ_favorites_user_item', ['restaurantId', 'userId', 'menuItemId'], {
  unique: true,
  where: '"userId" IS NOT NULL',
})
@Index('UQ_favorites_guest_item', ['restaurantId', 'guestId', 'menuItemId'], {
  unique: true,
  where: '"guestId" IS NOT NULL',
})
export class Favorite {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'uuid' })
  menuItemId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** Анонимный ID устройства (клиент генерирует и хранит в Keychain/SecureStore). */
  @Column({ type: 'uuid', nullable: true })
  guestId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
