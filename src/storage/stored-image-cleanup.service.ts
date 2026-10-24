import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  collectMenuItemImageUrls,
  collectPromoBannerImageUrls,
  collectRestaurantLogoUrls,
  urlsRemovedByUpdate,
} from './stored-image-urls.util';
import { StorageService } from './storage.service';

interface MenuItemImageRow {
  imageUrl: string;
  imageWebpUrl: string | null;
  galleryUrls: string[] | null;
  galleryWebpUrls: string[] | null;
}

interface PromoBannerImageRow {
  imageUrl: string;
  imageWebpUrl: string | null;
}

interface RestaurantLogoRow {
  logoUrl: string | null;
  logoWebpUrl: string | null;
}

@Injectable()
export class StoredImageCleanupService {
  private readonly logger = new Logger(StoredImageCleanupService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Удаляет объекты storage по URL. Внешние URL (не наш storage) пропускаются.
   * retain — URL, которые нельзя удалять (например, новые файлы после replace).
   */
  async deleteByUrls(
    urls: Iterable<string | null | undefined>,
    retain?: Iterable<string | null | undefined>,
  ): Promise<void> {
    const retainKeys = this.resolveKeys(retain ?? []);

    const keysToDelete = new Set<string>();
    for (const url of urls) {
      if (!url) {
        continue;
      }
      const key = this.storageService.resolveKeyFromUrl(url);
      if (!key || retainKeys.has(key)) {
        continue;
      }
      keysToDelete.add(key);
    }

    for (const key of keysToDelete) {
      try {
        await this.storageService.deleteObject(key);
      } catch (error) {
        this.logger.warn(
          `Не удалось удалить файл ${key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /** После PATCH: удалить старые URL, которых нет в новом состоянии; не трогать новые. */
  async deleteReplacedUrls(before: string[], after: string[]): Promise<void> {
    const removed = urlsRemovedByUpdate(before, after);
    await this.deleteByUrls(removed, after);
  }

  /** Все URL изображений заведения (логотип, меню, баннеры) — для bulk delete. */
  async collectRestaurantImageUrls(restaurantId: string): Promise<string[]> {
    const [restaurantRows, itemRows, bannerRows] = await Promise.all([
      this.dataSource.query<RestaurantLogoRow[]>(
        `SELECT "logoUrl", "logoWebpUrl" FROM restaurants WHERE id = $1`,
        [restaurantId],
      ),
      this.dataSource.query<MenuItemImageRow[]>(
        `SELECT "imageUrl", "imageWebpUrl", "galleryUrls", "galleryWebpUrls"
         FROM menu_items WHERE "restaurantId" = $1`,
        [restaurantId],
      ),
      this.dataSource.query<PromoBannerImageRow[]>(
        `SELECT "imageUrl", "imageWebpUrl"
         FROM restaurant_promo_banners WHERE "restaurantId" = $1`,
        [restaurantId],
      ),
    ]);

    const urls: string[] = [];

    if (restaurantRows[0]) {
      urls.push(...collectRestaurantLogoUrls(restaurantRows[0]));
    }

    for (const item of itemRows) {
      urls.push(
        ...collectMenuItemImageUrls({
          imageUrl: item.imageUrl,
          imageWebpUrl: item.imageWebpUrl,
          galleryUrls: item.galleryUrls ?? [],
          galleryWebpUrls: item.galleryWebpUrls ?? [],
        }),
      );
    }

    for (const banner of bannerRows) {
      urls.push(...collectPromoBannerImageUrls(banner));
    }

    return urls;
  }

  private resolveKeys(urls: Iterable<string | null | undefined>): Set<string> {
    const keys = new Set<string>();
    for (const url of urls) {
      if (!url) {
        continue;
      }
      const key = this.storageService.resolveKeyFromUrl(url);
      if (key) {
        keys.add(key);
      }
    }
    return keys;
  }
}
