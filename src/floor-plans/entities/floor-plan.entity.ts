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
import type { DecorLayoutData } from './decor-layout-data.type';

@Entity('floor_plans')
export class FloorPlan {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('idx_floor_plans_restaurant')
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column()
  name: string;

  /** Порядок зон в переключателе залов (Restoplace-like). */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** Депозит BYN при `DepositScheme.PER_ZONE`. */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  depositAmount: number;

  /**
   * JSON-схема не-бронируемых объектов зоны (стены, ломаные, зоны-полигоны, декор, текст, сетка).
   * Бронируемые столы хранятся в таблице `tables` (FK для броней) и мёржатся на фронтенде.
   */
  @Column({ type: 'jsonb', nullable: true })
  decorData: DecorLayoutData | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
