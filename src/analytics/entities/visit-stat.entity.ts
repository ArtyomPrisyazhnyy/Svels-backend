import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

@Entity('visit_stats')
export class VisitStat {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne('User', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userId' })
  user?: unknown;

  @Column({ type: 'date' })
  visitDate: string;

  @Column({ type: 'int', default: 1 })
  pageViews: number;

  @CreateDateColumn()
  createdAt: Date;
}
