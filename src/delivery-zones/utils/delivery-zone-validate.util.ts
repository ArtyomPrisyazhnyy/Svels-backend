import { BadRequestException } from '@nestjs/common';
import { DeliveryZoneType } from '../enums/delivery-zone-type.enum';
import type { GeoJsonPolygon } from '../types/geojson-polygon.type';

export function assertValidZoneGeometry(
  type: DeliveryZoneType,
  radiusMeters: number | null | undefined,
  polygon: GeoJsonPolygon | null | undefined,
): void {
  if (type === DeliveryZoneType.RADIUS) {
    if (radiusMeters == null || radiusMeters < 1) {
      throw new BadRequestException('Укажите радиус зоны доставки');
    }
    return;
  }

  if (type === DeliveryZoneType.POLYGON) {
    if (!polygon || polygon.type !== 'Polygon') {
      throw new BadRequestException(
        'Укажите полигон зоны доставки (GeoJSON Polygon)',
      );
    }
    const ring = polygon.coordinates?.[0];
    if (!ring || ring.length < 4) {
      throw new BadRequestException(
        'Полигон должен содержать не менее 3 вершин (замкнутое кольцо)',
      );
    }
    for (const vertex of ring) {
      if (
        !Array.isArray(vertex) ||
        vertex.length < 2 ||
        !Number.isFinite(vertex[0]) ||
        !Number.isFinite(vertex[1])
      ) {
        throw new BadRequestException('Некорректные координаты полигона');
      }
      const [lng, lat] = vertex;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new BadRequestException(
          'Координаты полигона вне допустимого диапазона',
        );
      }
    }
  }
}
