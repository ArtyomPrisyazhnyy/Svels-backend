import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
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

  @Column('uuid')
  restaurantId: string;

  @Column({ type: 'enum', enum: GuestOAuthProvider })
  provider: GuestOAuthProvider;

  @Column({ type: 'varchar', length: 255 })
  providerSubject: string;

  @Column({ type: 'varchar', length: 320 })
  email: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
