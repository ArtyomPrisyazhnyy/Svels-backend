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
import { TableObjectType } from '../../common/enums/table-object-type.enum';
import { TableShape } from '../../common/enums/table-shape.enum';
import type { TableSeat } from './table-seat.type';

@Entity('tables')
@Index('idx_tables_floor_plan', ['floorPlanId'])
@Index('idx_tables_restaurant', ['restaurantId'])
export class Table {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'uuid' })
  floorPlanId: string;

  @ManyToOne('FloorPlan', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'floorPlanId' })
  floorPlan?: unknown;

  @Column()
  label: string;

  /** Минимальное количество гостей для бронирования стола. */
  @Column({ type: 'int', default: 1 })
  minCapacity: number;

  /** Максимальная вместимость стола. */
  @Column({ type: 'int' })
  capacity: number;

  @Column({ type: 'float', nullable: true })
  positionX: number | null;

  @Column({ type: 'float', nullable: true })
  positionY: number | null;

  @Column({ type: 'float', default: 90 })
  width: number;

  @Column({ type: 'float', default: 90 })
  height: number;

  /**
   * Вершины произвольной формы (polygon) в локальных координатах стола
   * (относительно positionX/positionY): [x1,y1,x2,y2,...].
   * null для стандартных форм (rectangle/round/square/oval).
   */
  @Column({ type: 'jsonb', nullable: true })
  points: number[] | null;

  /**
   * Посадочные места (стулья/диваны/скамейки) — дочерние элементы стола.
   * Двигаются/вращаются вместе со столом. null = нет мест.
   */
  @Column({ type: 'jsonb', nullable: true })
  seats: TableSeat[] | null;

  /** Радиус скругления углов прямоугольных/квадратных столов (px). */
  @Column({ type: 'float', default: 6 })
  cornerRadius: number;

  /** Поворот в градусах 0..359. */
  @Column({ type: 'float', default: 0 })
  rotation: number;

  @Column({
    type: 'enum',
    enum: TableShape,
    default: TableShape.RECTANGLE,
  })
  shape: TableShape;

  @Column({
    type: 'enum',
    enum: TableObjectType,
    default: TableObjectType.TABLE,
  })
  objectType: TableObjectType;

  /** Депозит BYN при `DepositScheme.PER_TABLE` (0 = наследует зону/глобальную). */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  depositAmount: number;

  /** Доступен ли стол для онлайн-бронирования гостями. */
  @Column({ default: true })
  isActive: boolean;

  /** Виден ли стол гостям (false = только для сотрудников, как в Restoplace). */
  @Column({ default: true })
  visibleToGuests: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
