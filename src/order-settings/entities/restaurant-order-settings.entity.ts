import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('restaurant_order_settings')
export class RestaurantOrderSettings {
  @PrimaryColumn('uuid')
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ default: false })
  fulfillmentDelivery: boolean;

  @Column({ default: true })
  fulfillmentTakeaway: boolean;

  @Column({ default: true })
  fulfillmentDineIn: boolean;

  @Column({ default: true })
  paymentCash: boolean;

  @Column({ default: true })
  paymentCardOnSite: boolean;

  @Column({ default: true })
  paymentOnline: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
