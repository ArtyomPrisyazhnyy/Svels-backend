import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { GuestOAuthProvider } from '../enums/guest-oauth-provider.enum';

@Entity('guest_oauth_identities')
@Index(['restaurantId', 'provider', 'providerSubject'], { unique: true })
@Index(['userId'])
export class GuestOAuthIdentity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: unknown;

  @Column('uuid')
  restaurantId: string;

  @ManyToOne('Restaurant', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'enum', enum: GuestOAuthProvider })
  provider: GuestOAuthProvider;

  @Column({ type: 'varchar', length: 255 })
  providerSubject: string;

  @Column({ type: 'varchar', length: 320 })
  email: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
