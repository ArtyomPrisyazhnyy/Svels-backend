/** Собирает непустые URL изображений из полей сущности. */
export function collectStoredImageUrls(
  ...parts: Array<string | null | undefined | string[]>
): string[] {
  const urls: string[] = [];

  for (const part of parts) {
    if (part === null || part === undefined) {
      continue;
    }
    if (Array.isArray(part)) {
      for (const url of part) {
        const trimmed = url?.trim();
        if (trimmed) {
          urls.push(trimmed);
        }
      }
      continue;
    }
    const trimmed = part.trim();
    if (trimmed) {
      urls.push(trimmed);
    }
  }

  return urls;
}

export function collectMenuItemImageUrls(item: {
  imageUrl: string;
  imageWebpUrl: string | null;
  galleryUrls: string[];
  galleryWebpUrls: string[];
}): string[] {
  return collectStoredImageUrls(
    item.imageUrl,
    item.imageWebpUrl,
    item.galleryUrls,
    item.galleryWebpUrls,
  );
}

export function collectRestaurantLogoUrls(restaurant: {
  logoUrl: string | null;
  logoWebpUrl: string | null;
}): string[] {
  return collectStoredImageUrls(restaurant.logoUrl, restaurant.logoWebpUrl);
}

export function collectPromoBannerImageUrls(banner: {
  imageUrl: string;
  imageWebpUrl: string | null;
}): string[] {
  return collectStoredImageUrls(banner.imageUrl, banner.imageWebpUrl);
}

/** URL, которые были в before, но отсутствуют в after (после успешного обновления БД). */
export function urlsRemovedByUpdate(
  before: string[],
  after: string[],
): string[] {
  const afterSet = new Set(after);
  return before.filter((url) => !afterSet.has(url));
}
