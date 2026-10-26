/**
 * Копирование объектов между S3-совместимыми бакетами и опциональная замена URL в БД.
 *
 * Запуск (только с тестовыми/стейджинг окружениями — не против прод без бэкапа):
 *   npm run storage:migrate -- --dry-run
 *   npm run storage:migrate -- --concurrency 8
 *   npm run storage:migrate -- --rewrite-urls
 *   npm run storage:migrate -- --rewrite-urls --rewrite-apply
 *
 * Env назначения: S3_* (см. .env.example). Источник: SRC_S3_* (fallback YANDEX_*).
 */
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { config } from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Client } from 'pg';
import {
  createS3ClientConfig,
  resolveAppS3Env,
  resolveSrcS3Env,
} from '../src/config/s3-env';
import { toPgClientConfig } from '../src/database/pg-connection';

config();

export interface MigrateReport {
  listed: number;
  copied: number;
  skipped: number;
  verified: number;
  failed: number;
  dryRun: boolean;
}

export interface MigrateState {
  completedKeys: string[];
}

const DEFAULT_STATE_FILE = join(process.cwd(), '.storage-migrate-state.json');

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function etagMatches(
  sourceEtag: string | undefined,
  destEtag: string | undefined,
): boolean {
  if (!sourceEtag || !destEtag) {
    return false;
  }
  const normalize = (etag: string) => etag.replace(/^"|"$/g, '');
  return normalize(sourceEtag) === normalize(destEtag);
}

export async function loadState(stateFile: string): Promise<MigrateState> {
  try {
    const raw = await readFile(stateFile, 'utf8');
    const parsed = JSON.parse(raw) as MigrateState;
    return {
      completedKeys: Array.isArray(parsed.completedKeys)
        ? parsed.completedKeys
        : [],
    };
  } catch {
    return { completedKeys: [] };
  }
}

export async function saveState(
  stateFile: string,
  state: MigrateState,
): Promise<void> {
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

export async function listAllObjectKeys(
  client: S3Client,
  bucket: string,
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    for (const item of response.Contents ?? []) {
      if (item.Key) {
        keys.push(item.Key);
      }
    }
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

export interface CopyOneResult {
  status: 'copied' | 'skipped' | 'verified' | 'failed';
  key: string;
  reason?: string;
}

export async function copyOneObject(params: {
  sourceClient: S3Client;
  destClient: S3Client;
  sourceBucket: string;
  destBucket: string;
  key: string;
  dryRun: boolean;
}): Promise<CopyOneResult> {
  const { sourceClient, destClient, sourceBucket, destBucket, key, dryRun } =
    params;

  try {
    const sourceHead = await sourceClient.send(
      new HeadObjectCommand({ Bucket: sourceBucket, Key: key }),
    );

    const destHead = await destClient
      .send(new HeadObjectCommand({ Bucket: destBucket, Key: key }))
      .catch(() => null);

    if (
      destHead &&
      destHead.ContentLength === sourceHead.ContentLength &&
      etagMatches(sourceHead.ETag, destHead.ETag)
    ) {
      return { status: 'skipped', key };
    }

    if (dryRun) {
      return { status: 'copied', key, reason: 'dry-run' };
    }

    const object = await sourceClient.send(
      new GetObjectCommand({ Bucket: sourceBucket, Key: key }),
    );
    if (!object.Body) {
      return { status: 'failed', key, reason: 'empty body' };
    }

    const body = Buffer.from(await object.Body.transformToByteArray());
    const digest = createHash('md5').update(body).digest('hex');

    await destClient.send(
      new PutObjectCommand({
        Bucket: destBucket,
        Key: key,
        Body: body,
        ContentType: object.ContentType,
        CacheControl: object.CacheControl,
      }),
    );

    const verifyHead = await destClient.send(
      new HeadObjectCommand({ Bucket: destBucket, Key: key }),
    );

    if (verifyHead.ContentLength !== body.length) {
      return { status: 'failed', key, reason: 'size mismatch after put' };
    }

    const destEtag = verifyHead.ETag?.replace(/^"|"$/g, '');
    if (destEtag && destEtag !== digest && !destEtag.includes('-')) {
      return { status: 'failed', key, reason: 'etag mismatch after put' };
    }

    return { status: 'verified', key };
  } catch (error) {
    return { status: 'failed', key, reason: String(error) };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    const current = index;
    index += 1;
    if (current >= items.length) {
      return;
    }
    results[current] = await worker(items[current]);
    await runNext();
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runNext(),
  );
  await Promise.all(runners);
  return results;
}

export interface UrlRewriteCounts {
  menuItems: number;
  restaurants: number;
  promoBanners: number;
}

export async function rewriteStoredUrls(params: {
  client: Client;
  oldBase: string;
  newBase: string;
  apply: boolean;
}): Promise<UrlRewriteCounts> {
  const oldBase = params.oldBase.replace(/\/$/, '');
  const newBase = params.newBase.replace(/\/$/, '');
  const counts: UrlRewriteCounts = {
    menuItems: 0,
    restaurants: 0,
    promoBanners: 0,
  };

  if (!oldBase || !newBase || oldBase === newBase) {
    return counts;
  }

  const menu = await params.client.query<{ id: string }>(
    `SELECT id FROM menu_items
     WHERE "imageUrl" LIKE $1
        OR "imageWebpUrl" LIKE $1
        OR "galleryUrls"::text LIKE $1
        OR "galleryWebpUrls"::text LIKE $1`,
    [`${oldBase}%`],
  );
  counts.menuItems = menu.rowCount ?? 0;

  const restaurants = await params.client.query<{ id: string }>(
    `SELECT id FROM restaurants
     WHERE "logoUrl" LIKE $1 OR "logoWebpUrl" LIKE $1`,
    [`${oldBase}%`],
  );
  counts.restaurants = restaurants.rowCount ?? 0;

  const banners = await params.client.query<{ id: string }>(
    `SELECT id FROM restaurant_promo_banners
     WHERE "imageUrl" LIKE $1 OR "imageWebpUrl" LIKE $1`,
    [`${oldBase}%`],
  );
  counts.promoBanners = banners.rowCount ?? 0;

  if (!params.apply) {
    return counts;
  }

  await params.client.query(
    `UPDATE menu_items SET
       "imageUrl" = REPLACE("imageUrl", $1, $2),
       "imageWebpUrl" = REPLACE("imageWebpUrl", $1, $2),
       "galleryUrls" = REPLACE("galleryUrls"::text, $1, $2)::jsonb,
       "galleryWebpUrls" = REPLACE("galleryWebpUrls"::text, $1, $2)::jsonb
     WHERE "imageUrl" LIKE $3
        OR "imageWebpUrl" LIKE $3
        OR "galleryUrls"::text LIKE $3
        OR "galleryWebpUrls"::text LIKE $3`,
    [oldBase, newBase, `${oldBase}%`],
  );

  await params.client.query(
    `UPDATE restaurants SET
       "logoUrl" = REPLACE("logoUrl", $1, $2),
       "logoWebpUrl" = REPLACE("logoWebpUrl", $1, $2)
     WHERE "logoUrl" LIKE $3 OR "logoWebpUrl" LIKE $3`,
    [oldBase, newBase, `${oldBase}%`],
  );

  await params.client.query(
    `UPDATE restaurant_promo_banners SET
       "imageUrl" = REPLACE("imageUrl", $1, $2),
       "imageWebpUrl" = REPLACE("imageWebpUrl", $1, $2)
     WHERE "imageUrl" LIKE $3 OR "imageWebpUrl" LIKE $3`,
    [oldBase, newBase, `${oldBase}%`],
  );

  return counts;
}

async function migrateObjects(): Promise<MigrateReport> {
  const dryRun = hasFlag('--dry-run');
  const concurrency = Math.max(
    1,
    parseInt(readArg('--concurrency') ?? '4', 10),
  );
  const stateFile = readArg('--state-file') ?? DEFAULT_STATE_FILE;

  const src = resolveSrcS3Env();
  const dest = resolveAppS3Env();

  if (!src.bucket || !src.endpoint || !src.accessKeyId) {
    throw new Error(
      'Задайте SRC_S3_BUCKET, SRC_S3_ENDPOINT, SRC_S3_ACCESS_KEY_ID (или YANDEX_STORAGE_*)',
    );
  }
  if (!dest.bucket || !dest.endpoint || !dest.accessKeyId) {
    throw new Error(
      'Задайте S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID для назначения',
    );
  }

  const sourceClient = new S3Client(createS3ClientConfig(src));
  const destClient = new S3Client(createS3ClientConfig(dest));

  const state = await loadState(stateFile);
  const completed = new Set(state.completedKeys);

  const allKeys = await listAllObjectKeys(sourceClient, src.bucket);
  const pending = allKeys.filter((key) => !completed.has(key));

  const report: MigrateReport = {
    listed: allKeys.length,
    copied: 0,
    skipped: 0,
    verified: 0,
    failed: 0,
    dryRun,
  };

  console.log(
    `Objects: total=${allKeys.length}, pending=${pending.length}, concurrency=${concurrency}, dryRun=${dryRun}`,
  );

  await runWithConcurrency(pending, concurrency, async (key) => {
    const result = await copyOneObject({
      sourceClient,
      destClient,
      sourceBucket: src.bucket,
      destBucket: dest.bucket,
      key,
      dryRun,
    });

    switch (result.status) {
      case 'skipped':
        report.skipped += 1;
        completed.add(key);
        break;
      case 'copied':
        report.copied += 1;
        if (!dryRun) {
          completed.add(key);
        }
        break;
      case 'verified':
        report.verified += 1;
        completed.add(key);
        break;
      case 'failed':
        report.failed += 1;
        console.error(`FAIL ${key}: ${result.reason ?? 'unknown'}`);
        break;
      default:
        break;
    }

    if (!dryRun && completed.has(key)) {
      state.completedKeys = [...completed];
      await saveState(stateFile, state);
    }

    return result;
  });

  if (!dryRun) {
    state.completedKeys = [...completed];
    await saveState(stateFile, state);
  }

  return report;
}

async function main(): Promise<void> {
  const rewriteUrls = hasFlag('--rewrite-urls');
  const rewriteApply = hasFlag('--rewrite-apply');

  if (!hasFlag('--rewrite-only')) {
    const report = await migrateObjects();
    console.log('--- object copy report ---');
    console.log(JSON.stringify(report, null, 2));
  }

  if (rewriteUrls) {
    const src = resolveSrcS3Env();
    const dest = resolveAppS3Env();
    const oldBase = src.publicBaseUrl;
    const newBase = dest.publicBaseUrl;

    if (!oldBase || !newBase) {
      throw new Error(
        'Для --rewrite-urls задайте SRC_S3_PUBLIC_BASE_URL и S3_PUBLIC_BASE_URL',
      );
    }

    const client = new Client(toPgClientConfig());
    await client.connect();

    const counts = await rewriteStoredUrls({
      client,
      oldBase,
      newBase,
      apply: rewriteApply,
    });

    await client.end();

    console.log('--- URL rewrite ---');
    console.log(
      JSON.stringify(
        {
          dryRun: !rewriteApply,
          oldBase,
          newBase,
          rows: counts,
        },
        null,
        2,
      ),
    );
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
