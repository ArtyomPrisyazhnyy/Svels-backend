import { createHmac } from 'node:crypto';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { LocalObjectStorage } from '../src/storage/local-object-storage';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { closeE2eApp, createE2eApp } from './helpers/e2e-app';
import {
  discoverStaffProtectedRoutes,
  type HttpMethod,
} from './helpers/discover-protected-routes';
import {
  buildStaffTokens,
  E2E_ORDER_PHONE,
  fillRoutePath,
  seedVenueWithStaff,
  type VenueStaffTokens,
} from './helpers/security-fixtures';
const BOT_TOKEN = '123:TEST';

function signInitData(user: object): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
  };
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const hash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function loginTelegramGuest(
  app: NestFastifyApplication,
  restaurantId: string,
  telegramUser: { id: number; first_name: string },
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`/restaurants/${restaurantId}/auth/telegram`)
    .send({ initData: signInitData(telegramUser) })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}

function expectForbiddenOrNotFound(status: number): void {
  expect([403, 404]).toContain(status);
}

async function sendStaffRouteRequest(
  server: Parameters<typeof request>[0],
  method: HttpMethod,
  url: string,
  auth: string,
): Promise<{ status: number }> {
  switch (method) {
    case 'GET':
      return request(server).get(url).set('Authorization', auth);
    case 'DELETE':
      return request(server).delete(url).set('Authorization', auth);
    case 'POST':
      return request(server).post(url).set('Authorization', auth).send({});
    case 'PUT':
      return request(server).put(url).set('Authorization', auth).send({});
    case 'PATCH':
      return request(server).patch(url).set('Authorization', auth).send({});
    default:
      throw new Error('Unsupported HTTP method');
  }
}

describe('Security (e2e)', () => {
  let app: NestFastifyApplication;
  const runId = Date.now();
  let venueA: string;
  let venueB: string;
  let tokensA: VenueStaffTokens;
  let menuItemIdA: string;
  let previousBotToken: string | undefined;
  let previousCors: string | undefined;

  const staffProtectedRoutes = discoverStaffProtectedRoutes();

  beforeAll(async () => {
    previousBotToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    previousCors = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS = 'https://allowed.e2e.test';

    app = await createE2eApp({ productionHttpPlugins: true });

    const dataSource = app.get(DataSource);
    const fixtureA = await seedVenueWithStaff(dataSource, `sec-a-${runId}`, {
      paymentOnline: true,
    });
    const fixtureB = await seedVenueWithStaff(dataSource, `sec-b-${runId}`, {
      paymentOnline: true,
      restaurantName: 'Venue B',
    });
    venueA = fixtureA.restaurantId;
    venueB = fixtureB.restaurantId;
    menuItemIdA = fixtureA.menuItemId;
    tokensA = await buildStaffTokens(app, `sec-a-${runId}`);
  }, 120_000);

  afterAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = previousBotToken;
    process.env.CORS_ALLOWED_ORIGINS = previousCors;
    await closeE2eApp(app);
  });

  describe('tenant isolation (staff venue A → venue B)', () => {
    const roles: Array<keyof VenueStaffTokens> = [
      'owner',
      'manager',
      'hall',
      'production',
    ];

    it('discovers staff-protected routes from controllers', () => {
      expect(staffProtectedRoutes.length).toBeGreaterThan(40);
      const paths = new Set(staffProtectedRoutes.map((r) => r.path));
      expect(paths.has('restaurants/:restaurantId/payment-settings')).toBe(
        true,
      );
      expect(paths.has('restaurants/:restaurantId/pre-orders')).toBe(true);
    });

    for (const role of roles) {
      it(`role ${role} cannot access venue B staff endpoints`, async () => {
        const token = tokensA[role];
        for (const route of staffProtectedRoutes) {
          const url = `/${fillRoutePath(route.path, venueB)}`;
          const auth = `Bearer ${token}`;
          const server = app.getHttpServer();

          const res = await sendStaffRouteRequest(
            server,
            route.method,
            url,
            auth,
          );
          expectForbiddenOrNotFound(res.status);
        }
      });
    }
  });

  describe('role checks within one venue', () => {
    it('hall cannot read payment settings', async () => {
      await request(app.getHttpServer())
        .get(`/restaurants/${venueA}/payment-settings`)
        .set('Authorization', `Bearer ${tokensA.hall}`)
        .expect(403);
    });

    it('production cannot list staff bookings', async () => {
      await request(app.getHttpServer())
        .get(`/restaurants/${venueA}/bookings`)
        .set('Authorization', `Bearer ${tokensA.production}`)
        .expect(403);
    });

    it('manager cannot patch payment settings (owner-only)', async () => {
      await request(app.getHttpServer())
        .patch(`/restaurants/${venueA}/payment-settings`)
        .set('Authorization', `Bearer ${tokensA.manager}`)
        .send({ enabled: false })
        .expect(403);
    });

    it('hall cannot patch restaurant styling', async () => {
      await request(app.getHttpServer())
        .patch(`/restaurants/${venueA}/styling`)
        .set('Authorization', `Bearer ${tokensA.hall}`)
        .send({ primaryColor: '#000000' })
        .expect(403);
    });
  });

  describe('bePaid webhook auth', () => {
    it('rejects forged Basic Auth', async () => {
      await request(app.getHttpServer())
        .post('/payments/bepaid/webhook')
        .set(
          'Authorization',
          'Basic ' + Buffer.from('fake:fake').toString('base64'),
        )
        .send({ token: 'not-a-real-token' })
        .expect(400);
    });

    it('rejects wrong secret for known shop id', async () => {
      const shopId = `shop-sec-b-${runId}`.slice(0, 64);
      await request(app.getHttpServer())
        .post('/payments/bepaid/webhook')
        .set(
          'Authorization',
          'Basic ' + Buffer.from(`${shopId}:wrong-secret`).toString('base64'),
        )
        .send({ token: uuidv7() })
        .expect(400);
    });
  });

  describe('upload limits', () => {
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    it('rejects disallowed MIME type', async () => {
      await request(app.getHttpServer())
        .post(`/restaurants/${venueA}/menu/upload-image`)
        .set('Authorization', `Bearer ${tokensA.owner}`)
        .attach('file', tinyPng, {
          filename: 'evil.txt',
          contentType: 'text/plain',
        })
        .expect(400);
    });

    it('rejects oversized files', async () => {
      const big = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
      await request(app.getHttpServer())
        .post(`/restaurants/${venueA}/menu/upload-image`)
        .set('Authorization', `Bearer ${tokensA.owner}`)
        .attach('file', big, {
          filename: 'big.png',
          contentType: 'image/png',
        })
        .expect(413);
    });
  });

  describe('storage path traversal', () => {
    it('rejects keys with parent directory segments', async () => {
      const storage = new LocalObjectStorage();
      await expect(
        storage.putObject({
          key: '../outside.png',
          body: Buffer.from('x'),
          contentType: 'image/png',
        }),
      ).rejects.toThrow(/Invalid storage key/);
    });
  });

  describe('guest resource isolation', () => {
    let guest1Token: string;
    let guest2Token: string;
    let orderId: string;
    let addressId: string;

    beforeAll(async () => {
      guest1Token = await loginTelegramGuest(app, venueA, {
        id: 910_000_001,
        first_name: 'G1',
      });
      guest2Token = await loginTelegramGuest(app, venueA, {
        id: 910_000_002,
        first_name: 'G2',
      });

      const addrRes = await request(app.getHttpServer())
        .post(`/restaurants/${venueA}/me/addresses`)
        .set('Authorization', `Bearer ${guest1Token}`)
        .send({ street: 'Тест', house: '1' })
        .expect(201);
      addressId = (addrRes.body as { id: string }).id;

      const orderRes = await request(app.getHttpServer())
        .post(`/restaurants/${venueA}/pre-orders`)
        .set('Authorization', `Bearer ${guest1Token}`)
        .send({
          fulfillmentType: 'takeaway',
          paymentMethod: 'cash',
          items: [{ menuItemId: menuItemIdA, quantity: 1 }],
          customerName: 'G1',
          customerPhone: E2E_ORDER_PHONE,
        })
        .expect(201);
      orderId = (orderRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/restaurants/${venueA}/favorites/${menuItemIdA}`)
        .set('Authorization', `Bearer ${guest1Token}`)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });
    });

    it('guest cannot read another guest pre-order', async () => {
      await request(app.getHttpServer())
        .get(`/users/me/pre-orders/${orderId}`)
        .set('Authorization', `Bearer ${guest2Token}`)
        .expect(404);
    });

    it('guest cannot patch another guest address', async () => {
      await request(app.getHttpServer())
        .patch(`/restaurants/${venueA}/me/addresses/${addressId}`)
        .set('Authorization', `Bearer ${guest2Token}`)
        .send({ street: 'Чужая' })
        .expect(404);
    });

    it('guest B does not see guest A favorites', async () => {
      const res = await request(app.getHttpServer())
        .get(`/restaurants/${venueA}/favorites`)
        .set('Authorization', `Bearer ${guest2Token}`)
        .expect(200);
      const ids = (res.body as { menuItemIds: string[] }).menuItemIds;
      expect(ids).not.toContain(menuItemIdA);
    });
  });

  describe('helmet and CORS defaults', () => {
    it('sets security headers via helmet', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('denies disallowed CORS origin', async () => {
      const res = await request(app.getHttpServer())
        .options('/health')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows configured static origin', async () => {
      const res = await request(app.getHttpServer())
        .options('/health')
        .set('Origin', 'https://allowed.e2e.test')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBe(
        'https://allowed.e2e.test',
      );
    });
  });
});
