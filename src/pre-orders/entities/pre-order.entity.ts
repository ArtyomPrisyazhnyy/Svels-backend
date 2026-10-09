import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FulfillmentType } from '../../common/enums/fulfillment-type.enum';
import { OrderPaymentStatus } from '../../common/enums/order-payment-status.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';
import type { DeliveryAddressDto } from '../dto/pre-order.dto';

@Entity('pre_orders')
@Index(
  'UQ_pre_orders_restaurant_order_number',
  ['restaurantId', 'orderNumber'],
  {
    unique: true,
  },
)
@Index('IDX_pre_orders_restaurant_created_at', ['restaurantId', 'createdAt'])
@Index('IDX_pre_orders_restaurant_updated_at', ['restaurantId', 'updatedAt'])
export class PreOrder {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'int' })
  orderNumber: number;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne('User', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userId' })
  user?: unknown;

  @Column({ type: 'uuid', nullable: true })
  bookingId: string | null;

  @ManyToOne('Booking', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'bookingId' })
  booking?: unknown;

  @Column({
    type: 'enum',
    enum: PreOrderStatus,
    default: PreOrderStatus.NEW,
  })
  status: PreOrderStatus;

  @Column({
    type: 'enum',
    enum: OrderPaymentStatus,
    default: OrderPaymentStatus.NOT_REQUIRED,
  })
  paymentStatus: OrderPaymentStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: FulfillmentType })
  fulfillmentType: FulfillmentType;

  @Column({ type: 'varchar', length: 120 })
  customerName: string;

  @Column({ type: 'varchar', length: 32 })
  customerPhone: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  recipientName: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  recipientPhone: string | null;

  @Column({ type: 'jsonb', nullable: true })
  deliveryAddress: DeliveryAddressDto | null;

  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  requestedAt: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  cancelReason: string | null;

  @Column({ type: 'timestamptz' })
  statusChangedAt: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
