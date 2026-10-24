/**
 * Находит файлы в storage, на которые нет ссылок в БД.
 * По умолчанию — dry-run (только список). Для удаления: --apply
 *
 * Не запускать против production / Neon без явной необходимости.
 */
import { config } from 'dotenv';
import { Client } from 'pg';
import { toPgClientConfig } from '../src/database/pg-connection';
import { LocalObjectStorage } from '../src/storage/local-object-storage';
import { YandexObjectStorage } from '../src/storage/yandex-object-storage';
import {
  collectMenuItemImageUrls,
  collectPromoBannerImageUrls,
  collectRestaurantLogoUrls,
} from '../src/storage/stored-image-urls.util';
import type { ObjectStorage } from '../src/storage/storage.types';
import { ConfigService } from '@nestjs/config';
import storageConfig from '../src/config/storage.config';

config();

interface MenuItemRow {
  imageUrl: string;
  imageWebpUrl: string | null;
  galleryUrls: string[] | null;
  galleryWebpUrls: string[] | null;
}

interface PromoBannerRow {
  imageUrl: string;
  imageWebpUrl: string | null;
}

interface RestaurantRow {
  logoUrl: string | null;
  logoWebpUrl: string | null;
}

function buildObjectStorage(): ObjectStorage {
  const configService = new ConfigService(storageConfig());
  const driver = configService.get<'local' | 'yandex'>(
    'storage.driver',
    'local',
  );
  if (driver === 'yandex') {
    const yandex = new YandexObjectStorage(configService);
    yandex.onModuleInit();
    return yandex;
  }
  return new LocalObjectStorage();
}

async function loadReferencedKeys(
  client: Client,
  storage: ObjectStorage,
): Promise<Set<string>> {
  const keys = new Set<string>();

  const addUrl = (url: string | null | undefined): void => {
    if (!url) {
      return;
    }
    const key = storage.resolveKeyFromUrl(url);
    if (key) {
      keys.add(key);
    }
  };

  const restaurants = await client.query<RestaurantRow>(
    `SELECT "logoUrl", "logoWebpUrl" FROM restaurants`,
  );
  for (const row of restaurants.rows) {
    for (const url of collectRestaurantLogoUrls(row)) {
      addUrl(url);
    }
  }

  const items = await client.query<MenuItemRow>(
    `SELECT "imageUrl", "imageWebpUrl", "galleryUrls", "galleryWebpUrls" FROM menu_items`,
  );
  for (const row of items.rows) {
    for (const url of collectMenuItemImageUrls({
      imageUrl: row.imageUrl,
      imageWebpUrl: row.imageWebpUrl,
      galleryUrls: row.galleryUrls ?? [],
      galleryWebpUrls: row.galleryWebpUrls ?? [],
    })) {
      addUrl(url);
    }
  }

  const banners = await client.query<PromoBannerRow>(
    `SELECT "imageUrl", "imageWebpUrl" FROM restaurant_promo_banners`,
  );
  for (const row of banners.rows) {
    for (const url of collectPromoBannerImageUrls(row)) {
      addUrl(url);
    }
  }

  return keys;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const storage = buildObjectStorage();
  const client = new Client(toPgClientConfig());

  await client.connect();

  try {
    const referenced = await loadReferencedKeys(client, storage);
    const allKeys = await storage.listObjectKeys();
    const orphans = allKeys.filter((key) => !referenced.has(key));

    console.log(`Storage keys: ${allKeys.length}`);
    console.log(`Referenced keys: ${referenced.size}`);
    console.log(`Orphan keys: ${orphans.length}`);

    for (const key of orphans) {
      console.log(apply ? `DELETE ${key}` : `ORPHAN ${key}`);
      if (apply) {
        await storage.deleteObject(key);
      }
    }

    if (!apply && orphans.length > 0) {
      console.log('\nDry-run. Pass --apply to delete orphan objects.');
    }
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
