import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { PreOrderItemModifierSnapshot } from '../types/pre-order-item-modifier.types';

@Entity('pre_order_items')
export class PreOrderItem {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  preOrderId: string;

  @ManyToOne('PreOrder', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'preOrderId' })
  preOrder?: unknown;

  @Column({ type: 'uuid' })
  menuItemId: string;

  @ManyToOne('MenuItem', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'menuItemId' })
  menuItem?: unknown;

  @Column()
  name: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'jsonb', default: [] })
  modifiers: PreOrderItemModifierSnapshot[];

  @CreateDateColumn()
  createdAt: Date;
}
