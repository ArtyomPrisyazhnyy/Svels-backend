import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RestaurantStatus } from '../../common/enums/restaurant-status.enum';

@Entity('restaurants')
export class Restaurant {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column()
  address: string;

  @Column({ type: 'varchar', length: 9, nullable: true })
  unp: string | null;

  @Column({ type: 'enum', enum: RestaurantStatus, default: RestaurantStatus.PENDING })
  status: RestaurantStatus;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne('User', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'ownerId' })
  owner?: unknown;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
