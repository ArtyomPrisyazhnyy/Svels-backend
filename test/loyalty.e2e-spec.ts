import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PreOrderStatus } from '../src/common/enums/pre-order-status.enum';
import { UserRole } from '../src/common/enums/user-role.enum';
import { createE2eApp } from './helpers/e2e-app';
import { insertStaffUser, seedRestaurantBase } from './helpers/restaurant-seed';

const password = 'test-pass-12';

interface LoyaltyBalanceBody {
  userId: string;
  visits: number;
  currentLevel: { name: string } | null;
}

describe('Loyalty (e2e)', () => {
  let app: NestFastifyApplication;
  const runId = Date.now();

  let restaurantId: string;
  let menuItemId: string;
  let guestId: string;
  let guestToken: string;
  let adminToken: string;
  let hallToken: string;
  let productionToken: string;

  beforeAll(async () => {
    app = await createE2eApp();

    const dataSource = app.get(DataSource);
    const seeded = await seedRestaurantBase(dataSource, `loy-${runId}`);
    restaurantId = seeded.restaurantId;
    menuItemId = seeded.menuItemId;

    const hall = await insertStaffUser(
      dataSource,
      `loy-${runId}`,
      restaurantId,
      UserRole.RESTAURANT_HALL,
      'hall',
    );
    const production = await insertStaffUser(
      dataSource,
      `loy-${runId}`,
      restaurantId,
      UserRole.RESTAURANT_PRODUCTION,
      'production',
    );

    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `owner-loy-${runId}@e2e.test`, password })
      .expect(201);
    adminToken = (ownerLogin.body as { accessToken: string }).accessToken;

    const hallLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: hall.email, password })
      .expect(201);
    hallToken = (hallLogin.body as { accessToken: string }).accessToken;

    const productionLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: production.email, password })
      .expect(201);
    productionToken = (productionLogin.body as { accessToken: string })
      .accessToken;

    const guestRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `guest-loy-${runId}@e2e.test`,
        password,
        firstName: 'Loyal',
        lastName: 'Guest',
      })
      .expect(201);
    guestToken = (guestRegister.body as { accessToken: string }).accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);
    guestId = (meRes.body as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  async function advanceToCompleted(orderId: string): Promise<void> {
    const transitions = [
      PreOrderStatus.ACCEPTED,
      PreOrderStatus.PREPARING,
      PreOrderStatus.READY,
      PreOrderStatus.COMPLETED,
    ];
    for (const status of transitions) {
      const token =
        status === PreOrderStatus.PREPARING ? productionToken : hallToken;
      await request(app.getHttpServer())
        .patch(`/restaurants/${restaurantId}/pre-orders/${orderId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status })
        .expect(200);
    }
  }

  it('enables flame and accrues a visit when a guest order is completed', async () => {
    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}/loyalty-settings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        flameDisplayEnabled: true,
        flameLevels: [
          {
            name: 'Бронза',
            requiredVisits: 1,
            rewards: [{ type: 'custom', title: 'Кофе' }],
          },
        ],
      })
      .expect(200);

    const createRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Лоялти',
        customerPhone: '+375291112255',
      })
      .expect(201);
    const orderId = (createRes.body as { id: string }).id;

    await advanceToCompleted(orderId);

    let balance: LoyaltyBalanceBody | undefined;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = await request(app.getHttpServer())
        .get(`/restaurants/${restaurantId}/loyalty/me`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);
      balance = res.body as LoyaltyBalanceBody;
      if (balance.visits === 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    expect(balance?.visits).toBe(1);
    expect(balance?.currentLevel?.name).toBe('Бронза');
  });

  it('lets restaurant staff read a guest balance', async () => {
    const res = await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/loyalty/guests/${guestId}`)
      .set('Authorization', `Bearer ${hallToken}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({ userId: guestId, visits: 1 }),
    );
  });

  it('forbids a guest from reading another guest balance via staff endpoint', async () => {
    await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/loyalty/guests/${guestId}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(403);
  });

  it('requires authentication for the guest balance endpoint', async () => {
    await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/loyalty/me`)
      .expect(401);
  });
});
