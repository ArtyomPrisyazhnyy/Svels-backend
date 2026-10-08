import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  FlameLevelConfig,
  OtherLoyaltyProgramStub,
} from '../loyalty-settings.types';

@Entity('restaurant_loyalty_settings')
export class RestaurantLoyaltySettings {
  @PrimaryColumn('uuid')
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  /** Показывать огонёк гостю на сайте заведения. */
  @Column({ default: false })
  flameDisplayEnabled: boolean;

  /** Включены ли награды, завязанные на уровни огонька. */
  @Column({ default: false })
  flameRewardsEnabled: boolean;

  /** Дней без заказа, после которых огонёк гаснет. */
  @Column({ type: 'int', default: 14 })
  flameExpireDays: number;

  @Column({ type: 'jsonb', default: [] })
  flameLevels: FlameLevelConfig[];

  /** Будущие программы лояльности вне огонька (пока пустой конструктор). */
  @Column({ type: 'jsonb', default: [] })
  otherPrograms: OtherLoyaltyProgramStub[];

  @UpdateDateColumn()
  updatedAt: Date;
}
