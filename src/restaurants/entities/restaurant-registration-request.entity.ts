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

@Entity('restaurant_registration_requests')
export class RestaurantRegistrationRequest {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column()
  address: string;

  @Column({ type: 'varchar', length: 9 })
  unp: string;

  @Column({ type: 'boolean', default: false })
  isChain: boolean;

  @Column({ type: 'jsonb' })
  locations: { label?: string; city?: string; address: string }[];

  @Column({ type: 'uuid' })
  applicantId: string;

  @ManyToOne('User', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'applicantId' })
  applicant?: unknown;

  @Column({ type: 'enum', enum: RestaurantStatus, default: RestaurantStatus.PENDING })
  status: RestaurantStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
