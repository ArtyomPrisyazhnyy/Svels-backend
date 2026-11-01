import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('guest_loyalty_balances')
export class GuestLoyaltyBalance {
  @PrimaryColumn('uuid')
  restaurantId: string;

  @PrimaryColumn('uuid')
  userId: string;

  /** Визиты текущей серии (сбрасывается, когда серия сгорела). */
  @Column({ type: 'int', default: 0 })
  visits: number;

  @Column({ type: 'int', default: 0 })
  totalVisits: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastVisitAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  streakStartedAt: Date | null;

  /** Календарный день последнего визита в Europe/Minsk (YYYY-MM-DD). */
  @Column({ type: 'date', nullable: true })
  lastVisitDay: string | null;

  @Column({ type: 'int', default: 0 })
  streakDays: number;

  @Column({ type: 'int', default: 0 })
  longestStreak: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
