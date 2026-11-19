/**
 * Достраивает sm/md/lg для уже загруженных обложек меню.
 * Обложку (...jpg/.png + .webp) не перезаписывает.
 * Строки с непустым imageVariants пропускает (идемпотентно).
 *
 * Перед запуском примените миграцию ImgVariants1792100000000
 * (`npm run migration:run`) на той базе, которую будете обновлять.
 *
 *   npm run backfill:image-variants -- --dry-run
 *   npm run backfill:image-variants
 *
 * --dry-run читает БД и скачивает обложки, но не пишет в S3 и не обновляет БД.
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Client } from 'pg';
import {
  createS3ClientConfig,
  resolveAppS3Env,
  resolveStorageDriver,
} from '../src/config/s3-env';
import { toPgClientConfig } from '../src/database/pg-connection';
import {
  coverObjectKeyPrefix,
  renderResponsiveVariants,
  responsiveVariantObjectKey,
  RESPONSIVE_IMAGE_SIZES,
  type PublicImageVariants,
  type RenderedImageVariants,
} from '../src/media/responsive-image-variants';
import { resolveObjectKeyFromUrl } from '../src/storage/object-key-from-url';

config();

const dryRun = process.argv.includes('--dry-run');

const JPEG_QUALITY = parseInt(process.env.IMAGE_JPEG_QUALITY ?? '82', 10);
const WEBP_QUALITY = parseInt(process.env.IMAGE_WEBP_QUALITY ?? '80', 10);

interface MenuCoverRow {
  id: string;
  imageUrl: string;
  imageWebpUrl: string | null;
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
    return null;
  }
  return null;
}

async function readCover(url: string): Promise<Buffer> {
  const localPath = localPathFromUrl(url);
  if (localPath) {
    return readFile(localPath);
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('unsupported cover url');
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function publicVariantUrls(
  keyPrefix: string,
  rendered: RenderedImageVariants,
  toUrl: (key: string) => string,
): PublicImageVariants {
  const variants: PublicImageVariants = {};
  for (const size of RESPONSIVE_IMAGE_SIZES) {
    const file = rendered[size];
    if (!file) {
      continue;
    }
    variants[size] = {
      width: file.width,
      webp: toUrl(responsiveVariantObjectKey(keyPrefix, size, 'webp')),
      jpg: toUrl(responsiveVariantObjectKey(keyPrefix, size, 'jpg')),
    };
  }
  return variants;
}

async function main(): Promise<void> {
  const driver = resolveStorageDriver();
  const s3Env = resolveAppS3Env();
  if (driver === 's3' && (!s3Env.bucket || !s3Env.publicBaseUrl)) {
    throw new Error(
      'Для STORAGE_DRIVER=s3 задайте S3_BUCKET и S3_PUBLIC_BASE_URL',
    );
  }

  const s3 = driver === 's3' ? new S3Client(createS3ClientConfig(s3Env)) : null;
  const client = new Client(toPgClientConfig());
  await client.connect();
  console.log(`backfill image variants driver=${driver} dryRun=${dryRun}`);

  const toUrl = (key: string): string =>
    driver === 's3' ? `${s3Env.publicBaseUrl}/${key}` : `/uploads/${key}`;

  async function store(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (dryRun) {
      return;
    }
    if (driver === 's3' && s3) {
      await s3.send(
        new PutObjectCommand({
          Bucket: s3Env.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return;
    }
    const { mkdir, writeFile } = await import('fs/promises');
    const { dirname } = await import('path');
    const absolute = join(process.cwd(), 'uploads', key);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, body);
  }

  try {
    const rows = await client.query<MenuCoverRow>(
      `SELECT id, "imageUrl", "imageWebpUrl"
     FROM menu_items
     WHERE "imageVariants" IS NULL
     ORDER BY id`,
    );

    let updated = 0;
    let failed = 0;

    for (const row of rows.rows) {
      const sourceUrl = row.imageUrl || row.imageWebpUrl;
      if (!sourceUrl) {
        console.warn(`skip ${row.id}: empty cover`);
        failed += 1;
        continue;
      }

      const objectKey = resolveObjectKeyFromUrl(sourceUrl, {
        bucket: s3Env.bucket,
        publicBaseUrl: s3Env.publicBaseUrl,
        legacyPublicBaseUrls: s3Env.legacyPublicBaseUrls,
      });
      const keyPrefix = objectKey ? coverObjectKeyPrefix(objectKey) : null;
      if (!keyPrefix) {
        console.warn(`skip ${row.id}: cover is not an object in this storage`);
        failed += 1;
        continue;
      }

      let rendered: RenderedImageVariants;
      try {
        const buffer = await readCover(sourceUrl);
        rendered = await renderResponsiveVariants(buffer, {
          jpegQuality: JPEG_QUALITY,
          webpQuality: WEBP_QUALITY,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'read failed';
        console.warn(`skip ${row.id}: ${message}`);
        failed += 1;
        continue;
      }

      const variants = publicVariantUrls(keyPrefix, rendered, toUrl);
      const sizes = RESPONSIVE_IMAGE_SIZES.filter((size) => variants[size]);
      console.log(
        `${dryRun ? '[dry-run] ' : ''}${row.id} sizes=${sizes.join(',') || 'none'}`,
      );

      try {
        for (const size of sizes) {
          const file = rendered[size];
          if (!file) {
            continue;
          }
          await store(
            responsiveVariantObjectKey(keyPrefix, size, 'jpg'),
            file.jpgBuffer,
            'image/jpeg',
          );
          await store(
            responsiveVariantObjectKey(keyPrefix, size, 'webp'),
            file.webpBuffer,
            'image/webp',
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'upload failed';
        console.warn(`skip ${row.id}: ${message}`);
        failed += 1;
        continue;
      }

      if (dryRun) {
        updated += 1;
        continue;
      }

      const result = await client.query(
        `UPDATE menu_items
       SET "imageVariants" = $1::jsonb
       WHERE id = $2 AND "imageVariants" IS NULL`,
        [JSON.stringify(variants), row.id],
      );
      if (result.rowCount) {
        updated += 1;
      }
    }

    console.log(
      `${dryRun ? 'Dry run finished' : 'Backfill finished'}: candidates=${rows.rowCount ?? rows.rows.length} updated=${updated} failed=${failed}`,
    );
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'backfill failed';
  if (message.includes('imageVariants')) {
    console.error(
      'Сначала примените миграцию ImgVariants1792100000000: npm run migration:run',
    );
  }
  console.error(message);
  process.exit(1);
});
