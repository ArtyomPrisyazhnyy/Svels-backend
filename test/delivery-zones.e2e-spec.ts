import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { UserRole } from '../src/common/enums/user-role.enum';
import { createE2eApp, closeE2eApp } from './helpers/e2e-app';
import { insertStaffUser, seedRestaurantBase } from './helpers/restaurant-seed';

const password = 'test-pass-12';

describe('Delivery zones (e2e)', () => {
  let app: NestFastifyApplication;
  const runId = Date.now();

  let restaurantId: string;
  let locationId: string;
  let menuItemId: string;
  let adminToken: string;
  let managerToken: string;
  let guestToken: string;

  beforeAll(async () => {
    app = await createE2eApp();
    const dataSource = app.get(DataSource);
    const seeded = await seedRestaurantBase(dataSource, runId, {
      fulfillmentDelivery: true,
    });
    restaurantId = seeded.restaurantId;
    menuItemId = seeded.menuItemId;
    locationId = uuidv7();

    await dataSource.query(
      `INSERT INTO restaurant_locations (id, "restaurantId", city, address, label, lat, lng, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Minsk', 'Test st 1', 'Main', 53.9, 27.56, 0, now(), now())`,
      [locationId, restaurantId],
    );

    const manager = await insertStaffUser(
      dataSource,
      runId,
      restaurantId,
      UserRole.RESTAURANT_MANAGER,
      'manager',
    );

    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `owner-${runId}@e2e.test`, password })
      .expect(201);
    adminToken = (ownerLogin.body as { accessToken: string }).accessToken;

    const managerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: manager.email, password })
      .expect(201);
    managerToken = (managerLogin.body as { accessToken: string }).accessToken;

    const guestRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `guest-dz-${runId}@e2e.test`,
        password,
        firstName: 'Guest',
        lastName: 'DZ',
      })
      .expect(201);
    guestToken = (guestRegister.body as { accessToken: string }).accessToken;
  }, 120_000);

  afterAll(async () => {
    await closeE2eApp(app);
  });

  it('allows manager CRUD on delivery zones', async () => {
    const createRes = await request(app.getHttpServer())
      .post(
        `/restaurants/${restaurantId}/locations/${locationId}/delivery-zones`,
      )
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Center',
        type: 'radius',
        radiusMeters: 5000,
        deliveryFee: 4,
        minOrder: 25,
        freeDeliveryFrom: 40,
        priority: 1,
      })
      .expect(201);

    const zoneId = (createRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .get(
        `/restaurants/${restaurantId}/locations/${locationId}/delivery-zones`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .patch(
        `/restaurants/${restaurantId}/locations/${locationId}/delivery-zones/${zoneId}`,
      )
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ deliveryFee: 5 })
      .expect(200)
      .expect((res) => {
        expect((res.body as { deliveryFee: number }).deliveryFee).toBe(5);
      });
  });

  it('quotes in-zone and out-of-zone delivery', async () => {
    await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/delivery-quote`)
      .query({ lat: 53.9002, lng: 27.5602, subtotal: 20 })
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          status: string;
          deliveryFee: number;
          minOrder: number;
        };
        expect(body.status).toBe('in_zone');
        expect(body.deliveryFee).toBe(5);
        expect(body.minOrder).toBe(25);
      });

    await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/delivery-quote`)
      .query({ lat: 54.5, lng: 28 })
      .expect(200)
      .expect((res) => {
        expect((res.body as { status: string }).status).toBe('out_of_zone');
      });
  });

  it('rejects delivery order below min order and accepts with fee', async () => {
    const belowMin = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'delivery',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Анна',
        customerPhone: '+375290000001',
        deliveryAddress: {
          street: 'Ленина',
          house: '1',
          lat: 53.9002,
          lng: 27.5602,
        },
      })
      .expect(400);

    expect((belowMin.body as { code: string }).code).toBe('DELIVERY_MIN_ORDER');

    const outOfZone = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'delivery',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 2 }],
        customerName: 'Борис',
        customerPhone: '+375290000002',
        deliveryAddress: {
          street: 'Далёкая',
          house: '9',
          lat: 54.5,
          lng: 28,
        },
      })
      .expect(400);

    expect((outOfZone.body as { code: string }).code).toBe(
      'DELIVERY_OUT_OF_ZONE',
    );

    const ok = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'delivery',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 2 }],
        customerName: 'Виктор',
        customerPhone: '+375290000003',
        deliveryAddress: {
          street: 'Ленина',
          house: '2',
          lat: 53.9002,
          lng: 27.5602,
        },
      })
      .expect(201);

    const body = ok.body as {
      itemsSubtotal: number;
      deliveryFee: number;
      totalAmount: number;
      deliveryZoneId: string | null;
    };
    expect(body.itemsSubtotal).toBe(30);
    expect(body.deliveryFee).toBe(5);
    expect(body.totalAmount).toBe(35);
    expect(body.deliveryZoneId).toBeTruthy();
  });
});
