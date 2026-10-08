import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  PromoBannerAspectRatio,
  PromoBannerDisplayFrequency,
  PromoBannerType,
} from '../../common/enums/promo-banner.enum';

@Entity('restaurant_promo_banners')
export class PromoBanner {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'enum', enum: PromoBannerType })
  type: PromoBannerType;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 2048 })
  imageUrl: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  imageWebpUrl: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  linkUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({
    type: 'enum',
    enum: PromoBannerDisplayFrequency,
    default: PromoBannerDisplayFrequency.EVERY_VISIT,
  })
  displayFrequency: PromoBannerDisplayFrequency;

  @Column({
    type: 'enum',
    enum: PromoBannerAspectRatio,
    default: PromoBannerAspectRatio.RATIO_4_1,
  })
  aspectRatio: PromoBannerAspectRatio;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
