import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity('loyalty_visits')
@Unique('UQ_loyalty_visits_orderId', ['orderId'])
@Index('IDX_loyalty_visits_restaurant_user', ['restaurantId', 'userId'])
export class LoyaltyVisit {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
