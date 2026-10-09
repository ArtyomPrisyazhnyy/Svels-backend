import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('telegram_link_codes')
export class TelegramLinkCode {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  codeHash: string;

  @Index('IDX_telegram_link_codes_restaurantId')
  @Column({ type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}
