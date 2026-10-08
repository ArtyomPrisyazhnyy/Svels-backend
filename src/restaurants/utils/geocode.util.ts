export type GeoPoint = { lat: number; lng: number };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Геокодер OSM Nominatim (сервер, без CORS).
 * При ошибке/пустом ответе возвращает null — координаты задаёт админ на карте.
 */
export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'by');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Svels/1.0 (restaurant-locations)',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const rows = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
    }>;
    const first = rows[0];
    if (!first?.lat || !first?.lon) {
      return null;
    }

    return { lat: Number(first.lat), lng: Number(first.lon) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
