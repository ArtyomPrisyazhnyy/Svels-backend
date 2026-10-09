import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { BePaidApiClient } from '../src/payments/bepaid/bepaid-api.client';
import { PaymentStatus } from '../src/common/enums/payment-status.enum';
import { PreOrderStatus } from '../src/common/enums/pre-order-status.enum';
import { UserRole } from '../src/common/enums/user-role.enum';
import { createE2eApp } from './helpers/e2e-app';
import {
  insertStaffUser,
  insertSuperAdmin,
  seedRestaurantBase,
} from './helpers/restaurant-seed';

const password = 'test-pass-12';

describe('Orders flow (e2e)', () => {
  let app: NestFastifyApplication;
  const runId = Date.now();

  let restaurantId: string;
  let otherRestaurantId: string;
  let menuItemId: string;
  let guestToken: string;
  let otherGuestToken: string;
  let adminToken: string;
  let hallToken: string;
  let productionToken: string;
  let superAdminToken: string;
  let otherAdminToken: string;

  const bePaidMock = {
    createCheckout: jest.fn().mockResolvedValue({
      token: 'mock-checkout-token',
      redirectUrl: 'https://checkout.example/mock',
    }),
    capture: jest.fn().mockResolvedValue({
      status: 'successful',
      uid: 'capture-uid-1',
      message: 'ok',
      raw: {},
    }),
    void: jest.fn().mockResolvedValue({
      status: 'successful',
      uid: 'void-uid-1',
      message: 'ok',
      raw: {},
    }),
    queryByCheckoutToken: jest.fn(),
    assertCredentials: jest.fn(),
  };

  beforeAll(async () => {
    app = await createE2eApp((builder) =>
      builder.overrideProvider(BePaidApiClient).useValue(bePaidMock),
    );

    const dataSource = app.get(DataSource);
    const seeded = await seedRestaurantBase(dataSource, runId, {
      fulfillmentDelivery: true,
      paymentOnline: true,
    });
    restaurantId = seeded.restaurantId;
    menuItemId = seeded.menuItemId;

    const other = await seedRestaurantBase(dataSource, `${runId}-b`, {
      restaurantName: 'Other E2E',
    });
    otherRestaurantId = other.restaurantId;

    const hall = await insertStaffUser(
      dataSource,
      runId,
      restaurantId,
      UserRole.RESTAURANT_HALL,
      'hall',
    );
    const production = await insertStaffUser(
      dataSource,
      runId,
      restaurantId,
      UserRole.RESTAURANT_PRODUCTION,
      'production',
    );
    const otherAdmin = await insertStaffUser(
      dataSource,
      `${runId}-b`,
      otherRestaurantId,
      UserRole.RESTAURANT_ADMIN,
      'other-admin',
    );
    const superAdmin = await insertSuperAdmin(dataSource, runId);

    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `owner-${runId}@e2e.test`, password })
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

    const superLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: superAdmin.email, password })
      .expect(201);
    superAdminToken = (superLogin.body as { accessToken: string }).accessToken;

    const otherAdminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherAdmin.email, password })
      .expect(201);
    otherAdminToken = (otherAdminLogin.body as { accessToken: string })
      .accessToken;

    const guestRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `guest-${runId}@e2e.test`,
        password,
        firstName: 'Guest',
        lastName: 'One',
      })
      .expect(201);
    guestToken = (guestRegister.body as { accessToken: string }).accessToken;

    const otherGuestRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `guest2-${runId}@e2e.test`,
        password,
        firstName: 'Guest',
        lastName: 'Two',
      })
      .expect(201);
    otherGuestToken = (otherGuestRegister.body as { accessToken: string })
      .accessToken;
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

  it('creates takeaway order and completes status flow', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Иван',
        customerPhone: '+375291112233',
      })
      .expect(201);

    const orderId = (createRes.body as { id: string }).id;
    expect((createRes.body as { status: string }).status).toBe(
      PreOrderStatus.NEW,
    );

    await advanceToCompleted(orderId);

    const getRes = await request(app.getHttpServer())
      .get(`/users/me/pre-orders/${orderId}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);
    expect((getRes.body as { status: string }).status).toBe(
      PreOrderStatus.COMPLETED,
    );
  });

  it('creates delivery order with address', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'delivery',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 2 }],
        customerName: 'Пётр',
        customerPhone: '+375291112244',
        deliveryAddress: {
          street: 'Ленина',
          house: '10',
          apartment: '5',
        },
      })
      .expect(201);

    expect(
      (createRes.body as { fulfillmentType: string }).fulfillmentType,
    ).toBe('delivery');
    expect(
      (createRes.body as { deliveryAddress: { street: string } })
        .deliveryAddress.street,
    ).toBe('Ленина');
    expect((createRes.body as { totalAmount: number }).totalAmount).toBe(30);
  });

  it('returns ORDERS_PAUSED when orders are paused', async () => {
    const dataSource = app.get(DataSource);
    await dataSource.query(
      `UPDATE restaurant_order_settings SET "ordersPaused" = true WHERE "restaurantId" = $1`,
      [restaurantId],
    );

    const res = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Иван',
        customerPhone: '+375291112233',
      })
      .expect(409);

    expect((res.body as { code: string }).code).toBe('ORDERS_PAUSED');

    await dataSource.query(
      `UPDATE restaurant_order_settings SET "ordersPaused" = false WHERE "restaurantId" = $1`,
      [restaurantId],
    );
  });

  it('returns RESTAURANT_CLOSED outside opening hours', async () => {
    const closedRun = `${runId}-closed`;
    const dataSource = app.get(DataSource);
    const closed = await seedRestaurantBase(dataSource, closedRun, {
      closedSchedule: true,
    });

    const guest = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `guest-${closedRun}@e2e.test`,
        password,
        firstName: 'Closed',
        lastName: 'Guest',
      })
      .expect(201);
    const token = (guest.body as { accessToken: string }).accessToken;

    const res = await request(app.getHttpServer())
      .post(`/restaurants/${closed.restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        items: [{ menuItemId: closed.menuItemId, quantity: 1 }],
        customerName: 'Иван',
        customerPhone: '+375291112233',
      })
      .expect(409);

    expect((res.body as { code: string }).code).toBe('RESTAURANT_CLOSED');
  });

  it('captures and voids online payment hold via staff API', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'takeaway',
        paymentMethod: 'online',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Онлайн',
        customerPhone: '+375291112255',
      })
      .expect(201);

    const orderId = (createRes.body as { id: string }).id;
    expect(bePaidMock.createCheckout).toHaveBeenCalled();

    const dataSource = app.get(DataSource);
    await dataSource.query(
      `UPDATE payments SET status = $1, "bepaidUid" = $2 WHERE "preOrderId" = $3`,
      [PaymentStatus.AUTHORIZED, 'auth-uid-e2e', orderId],
    );

    const captureRes = await request(app.getHttpServer())
      .post(
        `/restaurants/${restaurantId}/pre-orders/${orderId}/payments/capture`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    expect((captureRes.body as { status: string }).status).toBe(
      PaymentStatus.CAPTURED,
    );
    expect(bePaidMock.capture).toHaveBeenCalled();

    const createRes2 = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'takeaway',
        paymentMethod: 'online',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Void',
        customerPhone: '+375291112266',
      })
      .expect(201);

    const orderId2 = (createRes2.body as { id: string }).id;
    await dataSource.query(
      `UPDATE payments SET status = $1, "bepaidUid" = $2 WHERE "preOrderId" = $3`,
      [PaymentStatus.AUTHORIZED, 'auth-uid-void', orderId2],
    );

    const voidRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders/${orderId2}/payments/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    expect((voidRes.body as { status: string }).status).toBe(
      PaymentStatus.VOIDED,
    );
    expect(bePaidMock.void).toHaveBeenCalled();
  });

  it('enforces guest and staff visibility rules', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Private',
        customerPhone: '+375291112277',
      })
      .expect(201);
    const orderId = (createRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .get(`/users/me/pre-orders/${orderId}`)
      .set('Authorization', `Bearer ${otherGuestToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/restaurants/${otherRestaurantId}/pre-orders/${orderId}`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/pre-orders/${orderId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
  });

  it('allows production role only kitchen transitions', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Kitchen',
        customerPhone: '+375291112288',
      })
      .expect(201);
    const orderId = (createRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}/pre-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${productionToken}`)
      .send({ status: PreOrderStatus.ACCEPTED })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}/pre-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${hallToken}`)
      .send({ status: PreOrderStatus.ACCEPTED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}/pre-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${productionToken}`)
      .send({ status: PreOrderStatus.PREPARING })
      .expect(200);
  });
});
