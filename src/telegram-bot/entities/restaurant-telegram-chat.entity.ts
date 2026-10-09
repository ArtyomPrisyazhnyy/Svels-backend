import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity('restaurant_telegram_chats')
@Unique('UQ_restaurant_telegram_chats_restaurant_chat', [
  'restaurantId',
  'chatId',
])
export class RestaurantTelegramChat {
  @PrimaryColumn('uuid')
  id: string;

  @Index('IDX_restaurant_telegram_chats_restaurantId')
  @Column({ type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'varchar', length: 32 })
  chatId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
