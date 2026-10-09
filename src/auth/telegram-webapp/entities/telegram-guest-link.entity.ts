import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity('telegram_guest_links')
@Unique('UQ_telegram_guest_links_userId', ['userId'])
export class TelegramGuestLink {
  @PrimaryColumn('uuid')
  restaurantId: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  telegramUserId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  telegramUsername: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
