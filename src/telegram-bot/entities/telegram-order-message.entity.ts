import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('telegram_order_messages')
export class TelegramOrderMessage {
  @PrimaryColumn({ type: 'uuid' })
  orderId: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  chatId: string;

  @Column({ type: 'bigint' })
  messageId: string;
}
