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
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingPlan } from './billing-plan.entity';

@Entity('billing_subscriptions')
@Index('IDX_billing_subscriptions_restaurant', ['restaurantId'], {
  unique: true,
})
export class BillingSubscription {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'uuid' })
  planId: string;

  @ManyToOne(() => BillingPlan, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'planId' })
  plan?: BillingPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  pastDueSince: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
