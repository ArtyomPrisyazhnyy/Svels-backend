import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MenuItemNutrition,
  MenuModifierGroup,
} from '../types/menu-modifier.types';

@Entity('menu_items')
export class MenuItem {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne('MenuCategory', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'categoryId' })
  category?: unknown;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  variantLabel: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  ingredients: string | null;

  @Column({ type: 'jsonb', nullable: true })
  nutrition: MenuItemNutrition | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  /** Перечёркнутая «старая» цена для отображения скидки; null — без скидки. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  oldPrice: number | null;

  @Column({ default: true })
  isAvailable: boolean;

  /** Fallback (JPEG/PNG) для браузеров без WebP. */
  @Column()
  imageUrl: string;

  /** WebP-вариант обложки; null — показывать только imageUrl. */
  @Column({ type: 'varchar', nullable: true })
  imageWebpUrl: string | null;

  /**
   * Дополнительные фотографии позиции (галерея в модальном окне товара).
   * Обложкой (карточкой в меню) остаётся imageUrl. Максимум 9 — итого до 10 фото.
   */
  @Column({ type: 'jsonb', default: [] })
  galleryUrls: string[];

  /** WebP-варианты галереи (параллельно galleryUrls по индексу). */
  @Column({ type: 'jsonb', default: [] })
  galleryWebpUrls: string[];

  @Column({ type: 'jsonb', default: [] })
  modifierGroups: MenuModifierGroup[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
