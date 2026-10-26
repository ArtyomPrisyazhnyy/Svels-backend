const EARTH_RADIUS_METERS = 6_371_000;

export type GeoPoint = { lat: number; lng: number };

export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ray-casting on GeoJSON ring vertices [lng, lat]. */
export function isPointInGeoJsonPolygon(
  point: GeoPoint,
  polygon: { coordinates: number[][][] },
): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 3) {
    return false;
  }

  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function isPointInRadiusZone(
  point: GeoPoint,
  center: GeoPoint,
  radiusMeters: number,
): boolean {
  if (radiusMeters <= 0) {
    return false;
  }
  return haversineDistanceMeters(point, center) <= radiusMeters;
}
