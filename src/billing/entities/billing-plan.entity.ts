import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BillingPlanCode } from '../enums/billing-plan-code.enum';

@Entity('billing_plans')
export class BillingPlan {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BillingPlanCode, unique: true })
  code: BillingPlanCode;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceMonthlyByn: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
