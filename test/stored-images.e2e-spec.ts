import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import {
  PromoBannerAspectRatio,
  PromoBannerDisplayFrequency,
  PromoBannerType,
} from '../src/common/enums/promo-banner.enum';
import { StorageService } from '../src/storage/storage.service';
import { createE2eApp } from './helpers/e2e-app';
import {
  insertSuperAdmin,
  seedRestaurantBase,
} from './helpers/restaurant-seed';

const password = 'test-pass-12';

function uploadPath(key: string): string {
  return join(process.cwd(), 'uploads', key);
}

async function putFile(
  storage: StorageService,
  key: string,
): Promise<{ url: string; key: string }> {
  const stored = await storage.putObject({
    key,
    body: Buffer.from('e2e-image-bytes'),
    contentType: 'image/jpeg',
  });
  return { url: stored.url, key: stored.key };
}

describe('Stored image cleanup (e2e)', () => {
  let app: NestFastifyApplication;
  let storage: StorageService;
  const runId = Date.now();

  let restaurantId: string;
  let menuItemId: string;
  let categoryId: string;
  let adminToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    app = await createE2eApp();
    storage = app.get(StorageService);

    const dataSource = app.get(DataSource);
    const seeded = await seedRestaurantBase(dataSource, `img-${runId}`);
    restaurantId = seeded.restaurantId;
    menuItemId = seeded.menuItemId;
    categoryId = seeded.categoryId;

    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `owner-img-${runId}@e2e.test`, password })
      .expect(201);
    adminToken = (ownerLogin.body as { accessToken: string }).accessToken;

    const superAdmin = await insertSuperAdmin(dataSource, `img-${runId}`);
    const superLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: superAdmin.email, password })
      .expect(201);
    superAdminToken = (superLogin.body as { accessToken: string }).accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('removes replaced menu item cover files after PATCH', async () => {
    const oldCover = await putFile(
      storage,
      `menu/${restaurantId}/e2e-old-cover.jpg`,
    );
    const oldWebp = await putFile(
      storage,
      `menu/${restaurantId}/e2e-old-cover.webp`,
    );
    const newCover = await putFile(
      storage,
      `menu/${restaurantId}/e2e-new-cover.jpg`,
    );
    const newWebp = await putFile(
      storage,
      `menu/${restaurantId}/e2e-new-cover.webp`,
    );

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}/menu/items/${menuItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        imageUrl: newCover.url,
        imageWebpUrl: newWebp.url,
      })
      .expect(200);

    expect(existsSync(uploadPath(oldCover.key))).toBe(false);
    expect(existsSync(uploadPath(oldWebp.key))).toBe(false);
    expect(existsSync(uploadPath(newCover.key))).toBe(true);
    expect(existsSync(uploadPath(newWebp.key))).toBe(true);
  });

  it('removes menu item images after DELETE', async () => {
    const dataSource = app.get(DataSource);
    const itemId = uuidv7();
    await dataSource.query(
      `INSERT INTO menu_items (id, "restaurantId", "categoryId", name, price, "isAvailable", "imageUrl", "imageWebpUrl", "modifierGroups", "galleryUrls", "galleryWebpUrls", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Soup', 5, true, $4, $5, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, now(), now())`,
      [itemId, restaurantId, categoryId, '/pending.jpg', null],
    );

    const cover = await putFile(
      storage,
      `menu/${restaurantId}/e2e-delete-item.jpg`,
    );
    const webp = await putFile(
      storage,
      `menu/${restaurantId}/e2e-delete-item.webp`,
    );

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}/menu/items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imageUrl: cover.url, imageWebpUrl: webp.url })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/restaurants/${restaurantId}/menu/items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(existsSync(uploadPath(cover.key))).toBe(false);
    expect(existsSync(uploadPath(webp.key))).toBe(false);
  });

  it('removes replaced restaurant logo files after PATCH', async () => {
    const oldLogo = await putFile(
      storage,
      `restaurants/${restaurantId}/logo/e2e-old-logo.jpg`,
    );
    const oldWebp = await putFile(
      storage,
      `restaurants/${restaurantId}/logo/e2e-old-logo.webp`,
    );
    const newLogo = await putFile(
      storage,
      `restaurants/${restaurantId}/logo/e2e-new-logo.jpg`,
    );
    const newWebp = await putFile(
      storage,
      `restaurants/${restaurantId}/logo/e2e-new-logo.webp`,
    );

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ logoUrl: oldLogo.url, logoWebpUrl: oldWebp.url })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ logoUrl: newLogo.url, logoWebpUrl: newWebp.url })
      .expect(200);

    expect(existsSync(uploadPath(oldLogo.key))).toBe(false);
    expect(existsSync(uploadPath(newLogo.key))).toBe(true);
  });

  it('removes promo banner images on update and delete', async () => {
    const image = await putFile(
      storage,
      `restaurants/${restaurantId}/banners/e2e-banner.jpg`,
    );
    const webp = await putFile(
      storage,
      `restaurants/${restaurantId}/banners/e2e-banner.webp`,
    );

    const created = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/promo-banners`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: PromoBannerType.MODAL,
        imageUrl: image.url,
        imageWebpUrl: webp.url,
        displayFrequency: PromoBannerDisplayFrequency.EVERY_VISIT,
        aspectRatio: PromoBannerAspectRatio.RATIO_4_1,
      })
      .expect(201);

    const bannerId = (created.body as { id: string }).id;

    const nextImage = await putFile(
      storage,
      `restaurants/${restaurantId}/banners/e2e-banner-next.jpg`,
    );
    const nextWebp = await putFile(
      storage,
      `restaurants/${restaurantId}/banners/e2e-banner-next.webp`,
    );

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}/promo-banners/${bannerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imageUrl: nextImage.url, imageWebpUrl: nextWebp.url })
      .expect(200);

    expect(existsSync(uploadPath(image.key))).toBe(false);
    expect(existsSync(uploadPath(webp.key))).toBe(false);

    await request(app.getHttpServer())
      .delete(`/restaurants/${restaurantId}/promo-banners/${bannerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    expect(existsSync(uploadPath(nextImage.key))).toBe(false);
    expect(existsSync(uploadPath(nextWebp.key))).toBe(false);
  });

  it('bulk-deletes menu item images when category with items is removed', async () => {
    const dataSource = app.get(DataSource);
    const bulkCategoryId = uuidv7();
    await dataSource.query(
      `INSERT INTO menu_categories (id, "restaurantId", name, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Bulk', 99, now(), now())`,
      [bulkCategoryId, restaurantId],
    );

    const cover = await putFile(storage, `menu/${restaurantId}/e2e-bulk.jpg`);
    const webp = await putFile(storage, `menu/${restaurantId}/e2e-bulk.webp`);

    await dataSource.query(
      `INSERT INTO menu_items (id, "restaurantId", "categoryId", name, price, "isAvailable", "imageUrl", "imageWebpUrl", "modifierGroups", "galleryUrls", "galleryWebpUrls", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Bulk item', 9, true, $4, $5, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, now(), now())`,
      [uuidv7(), restaurantId, bulkCategoryId, cover.url, webp.url],
    );

    await request(app.getHttpServer())
      .delete(`/restaurants/${restaurantId}/menu/categories/${bulkCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    expect(existsSync(uploadPath(cover.key))).toBe(false);
    expect(existsSync(uploadPath(webp.key))).toBe(false);
  });

  it('removes all restaurant images when super admin deletes restaurant', async () => {
    const dataSource = app.get(DataSource);
    const seeded = await seedRestaurantBase(dataSource, `img-del-${runId}`);
    const logo = await putFile(
      storage,
      `restaurants/${seeded.restaurantId}/logo/e2e-rest-del.jpg`,
    );
    const itemImage = await putFile(
      storage,
      `menu/${seeded.restaurantId}/e2e-rest-del-item.jpg`,
    );

    await dataSource.query(
      `UPDATE menu_items SET "imageUrl" = $1 WHERE id = $2`,
      [itemImage.url, seeded.menuItemId],
    );
    await dataSource.query(
      `UPDATE restaurants SET "logoUrl" = $1 WHERE id = $2`,
      [logo.url, seeded.restaurantId],
    );

    await request(app.getHttpServer())
      .delete(`/restaurants/${seeded.restaurantId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(existsSync(uploadPath(logo.key))).toBe(false);
    expect(existsSync(uploadPath(itemImage.key))).toBe(false);
  });
});
