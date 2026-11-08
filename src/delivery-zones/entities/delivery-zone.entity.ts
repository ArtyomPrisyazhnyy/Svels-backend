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
import { DeliveryZoneType } from '../enums/delivery-zone-type.enum';
import type { GeoJsonPolygon } from '../types/geojson-polygon.type';

@Entity('delivery_zones')
@Index('IDX_delivery_zones_location_active', ['locationId', 'isActive'])
@Index('IDX_delivery_zones_restaurant', ['restaurantId'])
export class DeliveryZone {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({ type: 'uuid' })
  locationId: string;

  @ManyToOne('RestaurantLocation', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'locationId' })
  location?: unknown;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'enum', enum: DeliveryZoneType })
  type: DeliveryZoneType;

  @Column({ type: 'int', nullable: true })
  radiusMeters: number | null;

  @Column({ type: 'jsonb', nullable: true })
  polygon: GeoJsonPolygon | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  deliveryFee: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  minOrder: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  freeDeliveryFrom: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
