/**
 * Переносит локальные /uploads изображения в текущий STORAGE_DRIVER (s3),
 * конвертирует в JPEG/PNG fallback + WebP и сохраняет object keys в БД.
 *
 * Перед запуском:
 * 1. Настройте S3 в .env (STORAGE_DRIVER=s3, S3_*)
 * 2. Включите публичное чтение объектов в бакете
 * 3. Убедитесь, что колонки imageWebpUrl / galleryWebpUrls / logoWebpUrl существуют
 *    (dev: synchronize; prod: scripts/add-image-webp-columns.sql)
 *
 * Запуск из Svels-backend:
 *   npm run migrate:images
 *   npm run migrate:images -- --dry-run
 */
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Client } from 'pg';
import { toPgClientConfig } from '../src/database/pg-connection';
import sharp from 'sharp';

config();

const dryRun = process.argv.includes('--dry-run');

const MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH ?? '1600', 10);
const JPEG_QUALITY = parseInt(process.env.IMAGE_JPEG_QUALITY ?? '82', 10);
const WEBP_QUALITY = parseInt(process.env.IMAGE_WEBP_QUALITY ?? '80', 10);

type Driver = 'local' | 's3';

function parseBooleanEnv(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }
  return raw === 'true' || raw === '1';
}

interface Converted {
  fallbackBuffer: Buffer;
  fallbackContentType: string;
  fallbackExtension: string;
  webpBuffer: Buffer;
}

async function convertImage(buffer: Buffer, mimeHint: string): Promise<Converted> {
  const image = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();
  const pipeline =
    metadata.width && metadata.width > MAX_WIDTH
      ? image.resize({ width: MAX_WIDTH, withoutEnlargement: true })
      : image;

  const hasAlpha = Boolean(metadata.hasAlpha);
  const preferPng = hasAlpha || mimeHint.includes('png');

  const [fallbackBuffer, webpBuffer] = await Promise.all([
    preferPng
      ? pipeline.clone().png({ compressionLevel: 8 }).toBuffer()
      : pipeline.clone().jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer(),
    pipeline.clone().webp({ quality: WEBP_QUALITY }).toBuffer(),
  ]);

  return {
    fallbackBuffer,
    fallbackContentType: preferPng ? 'image/png' : 'image/jpeg',
    fallbackExtension: preferPng ? '.png' : '.jpg',
    webpBuffer,
  };
}

function guessMime(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function localPathFromUrl(url: string): string | null {
  if (url.startsWith('/uploads/')) {
    return join(process.cwd(), url.slice(1));
  }
  try {
    const { pathname } = new URL(url);
    if (pathname.startsWith('/uploads/')) {
      return join(process.cwd(), pathname.slice(1));
    }
  } catch {
    // ignore
  }
  return null;
}

function isAlreadyMigratedKey(url: string, webpUrl: string | null): boolean {
  if (!webpUrl) return false;
  if (url.startsWith('http') || url.startsWith('/uploads/')) {
    return false;
  }
  return webpUrl.endsWith('.webp');
}

async function main(): Promise<void> {
  const driver = (process.env.STORAGE_DRIVER ?? 'local') as Driver;
  const bucket = process.env.S3_BUCKET ?? '';
  const endpoint = process.env.S3_ENDPOINT ?? '';

  if (driver === 's3' && (!bucket || !endpoint)) {
    throw new Error('Для STORAGE_DRIVER=s3 задайте S3_BUCKET и S3_ENDPOINT');
  }

  const s3 =
    driver === 's3'
      ? new S3Client({
          region: process.env.S3_REGION ?? 'us-east-1',
          endpoint,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
          },
          forcePathStyle: parseBooleanEnv(process.env.S3_FORCE_PATH_STYLE, true),
        })
      : null;

  const client = new Client(toPgClientConfig());

  await client.connect();
  console.log(`Driver=${driver}, dryRun=${dryRun}`);

  async function store(key: string, body: Buffer, contentType: string): Promise<string> {
    if (dryRun) {
      return key;
    }

    if (driver === 's3' && s3) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return key;
    }

    const { mkdir, writeFile } = await import('fs/promises');
    const { dirname } = await import('path');
    const absolute = join(process.cwd(), 'uploads', key);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, body);
    return key;
  }

  async function migrateOne(
    sourceUrl: string,
    keyPrefix: string,
  ): Promise<{ fallbackKey: string; webpKey: string } | null> {
    const localPath = localPathFromUrl(sourceUrl);
    let buffer: Buffer | null = null;

    if (localPath) {
      try {
        buffer = await readFile(localPath);
      } catch {
        console.warn(`  skip: file not found ${localPath}`);
        return null;
      }
    } else if (sourceUrl.startsWith('http')) {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
          console.warn(`  skip: HTTP ${response.status} ${sourceUrl}`);
          return null;
        }
        buffer = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        console.warn(`  skip: fetch failed ${sourceUrl}: ${String(error)}`);
        return null;
      }
    } else {
      console.warn(`  skip: unsupported url ${sourceUrl}`);
      return null;
    }

    const converted = await convertImage(buffer, guessMime(sourceUrl));
    const fallbackKey = `${keyPrefix}${converted.fallbackExtension}`;
    const webpKey = `${keyPrefix}.webp`;

    const [storedFallbackKey, storedWebpKey] = await Promise.all([
      store(fallbackKey, converted.fallbackBuffer, converted.fallbackContentType),
      store(webpKey, converted.webpBuffer, 'image/webp'),
    ]);

    return { fallbackKey: storedFallbackKey, webpKey: storedWebpKey };
  }

  // --- menu items ---
  const items = await client.query<{
    id: string;
    restaurantId: string;
    imageUrl: string;
    imageWebpUrl: string | null;
    galleryUrls: string[] | null;
    galleryWebpUrls: string[] | null;
  }>(
    `SELECT id, "restaurantId", "imageUrl", "imageWebpUrl", "galleryUrls", "galleryWebpUrls"
     FROM menu_items`,
  );

  for (const item of items.rows) {
    console.log(`Menu item ${item.id}`);
    let imageUrl = item.imageUrl;
    let imageWebpUrl = item.imageWebpUrl;
    const galleryUrls = [...(item.galleryUrls ?? [])];
    const galleryWebpUrls = [...(item.galleryWebpUrls ?? [])];

    if (!isAlreadyMigratedKey(item.imageUrl, item.imageWebpUrl)) {
      const migrated = await migrateOne(
        item.imageUrl,
        `menu/${item.restaurantId}/${item.id}-cover`,
      );
      if (migrated) {
        imageUrl = migrated.fallbackKey;
        imageWebpUrl = migrated.webpKey;
        console.log(`  cover → ${imageUrl}`);
      }
    } else {
      console.log('  cover already migrated');
    }

    for (let i = 0; i < galleryUrls.length; i += 1) {
      const current = galleryUrls[i];
      const currentWebp = galleryWebpUrls[i] ?? null;
      if (isAlreadyMigratedKey(current, currentWebp)) {
        continue;
      }
      const migrated = await migrateOne(
        current,
        `menu/${item.restaurantId}/${item.id}-gallery-${i}`,
      );
      if (migrated) {
        galleryUrls[i] = migrated.fallbackKey;
        galleryWebpUrls[i] = migrated.webpKey;
        console.log(`  gallery[${i}] → ${migrated.fallbackKey}`);
      }
    }

    // выровнять длины массивов
    while (galleryWebpUrls.length < galleryUrls.length) {
      galleryWebpUrls.push('');
    }
    galleryWebpUrls.length = galleryUrls.length;

    if (!dryRun) {
      await client.query(
        `UPDATE menu_items
         SET "imageUrl" = $1,
             "imageWebpUrl" = $2,
             "galleryUrls" = $3::jsonb,
             "galleryWebpUrls" = $4::jsonb
         WHERE id = $5`,
        [
          imageUrl,
          imageWebpUrl,
          JSON.stringify(galleryUrls),
          JSON.stringify(galleryWebpUrls),
          item.id,
        ],
      );
    }
  }

  // --- logos ---
  const restaurants = await client.query<{
    id: string;
    logoUrl: string | null;
    logoWebpUrl: string | null;
  }>(`SELECT id, "logoUrl", "logoWebpUrl" FROM restaurants`);

  for (const restaurant of restaurants.rows) {
    if (!restaurant.logoUrl) continue;
    console.log(`Restaurant logo ${restaurant.id}`);
    if (isAlreadyMigratedKey(restaurant.logoUrl, restaurant.logoWebpUrl)) {
      console.log('  already migrated');
      continue;
    }
    const migrated = await migrateOne(
      restaurant.logoUrl,
      `restaurants/${restaurant.id}/logo/${restaurant.id}`,
    );
    if (!migrated) continue;
    console.log(`  logo → ${migrated.fallbackKey}`);
    if (!dryRun) {
      await client.query(
        `UPDATE restaurants SET "logoUrl" = $1, "logoWebpUrl" = $2 WHERE id = $3`,
        [migrated.fallbackKey, migrated.webpKey, restaurant.id],
      );
    }
  }

  await client.end();

  // silence unused import in local-only path
  void DeleteObjectCommand;

  console.log(dryRun ? 'Dry run finished (DB not updated).' : 'Migration finished.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
