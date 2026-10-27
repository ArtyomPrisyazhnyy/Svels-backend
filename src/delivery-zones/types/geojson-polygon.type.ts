/** GeoJSON Polygon (WGS84): coordinates[ring][point] = [longitude, latitude]. */
export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};
