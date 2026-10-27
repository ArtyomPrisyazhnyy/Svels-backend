import {
  haversineDistanceMeters,
  isPointInGeoJsonPolygon,
  isPointInRadiusZone,
} from './delivery-geo.util';

describe('delivery-geo.util', () => {
  const center = { lat: 53.9, lng: 27.56 };

  it('haversineDistanceMeters returns ~0 for same point', () => {
    expect(haversineDistanceMeters(center, center)).toBeLessThan(1);
  });

  it('isPointInRadiusZone respects radius', () => {
    const near = { lat: 53.9005, lng: 27.5605 };
    expect(isPointInRadiusZone(near, center, 200)).toBe(true);
    expect(isPointInRadiusZone({ lat: 54.5, lng: 28 }, center, 200)).toBe(
      false,
    );
  });

  it('isPointInGeoJsonPolygon detects inside square', () => {
    const polygon = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [27.55, 53.89],
          [27.57, 53.89],
          [27.57, 53.91],
          [27.55, 53.91],
          [27.55, 53.89],
        ],
      ],
    };
    expect(isPointInGeoJsonPolygon({ lat: 53.9, lng: 27.56 }, polygon)).toBe(
      true,
    );
    expect(isPointInGeoJsonPolygon({ lat: 53.85, lng: 27.56 }, polygon)).toBe(
      false,
    );
  });
});
