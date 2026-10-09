import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { AppModule } from '../src/app.module';
import { AuthProvider } from '../src/common/enums/auth-provider.enum';
import { PreOrderStatus } from '../src/common/enums/pre-order-status.enum';
import { RestaurantStatus } from '../src/common/enums/restaurant-status.enum';
import { UserRole } from '../src/common/enums/user-role.enum';

describe('PreOrders staff (e2e)', () => {
  let app: NestFastifyApplication;
  let restaurantId: string;
  let menuItemId: string;
  let guestToken: string;
  let hallToken: string;
  const password = 'test-pass-12';
  const runId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const dataSource = app.get(DataSource);
    const ownerId = uuidv7();
    restaurantId = uuidv7();
    const hallUserId = uuidv7();
    const categoryId = uuidv7();
    menuItemId = uuidv7();
    const passwordHash = await bcrypt.hash(password, 12);

    await dataSource.query(
      `INSERT INTO users (id, email, phone, "passwordHash", "firstName", "lastName", role, "authProvider", "restaurantId", "createdAt", "updatedAt")
       VALUES ($1, $2, NULL, $3, 'Owner', 'Test', $4, $5, $6, now(), now())`,
      [
        ownerId,
        `owner-${runId}@e2e.test`,
        passwordHash,
        UserRole.RESTAURANT_ADMIN,
        AuthProvider.LOCAL,
        restaurantId,
      ],
    );

    await dataSource.query(
      `INSERT INTO restaurants (id, name, address, status, "ownerId", "createdAt", "updatedAt")
       VALUES ($1, 'E2E Cafe', 'Addr 1', $2, $3, now(), now())`,
      [restaurantId, RestaurantStatus.APPROVED, ownerId],
    );

    await dataSource.query(
      `INSERT INTO users (id, email, phone, "passwordHash", "firstName", "lastName", role, "authProvider", "restaurantId", "createdAt", "updatedAt")
       VALUES ($1, $2, NULL, $3, 'Hall', 'Staff', $4, $5, $6, now(), now())`,
      [
        hallUserId,
        `hall-${runId}@e2e.test`,
        passwordHash,
        UserRole.RESTAURANT_HALL,
        AuthProvider.LOCAL,
        restaurantId,
      ],
    );

    await dataSource.query(
      `INSERT INTO restaurant_order_settings ("restaurantId", "fulfillmentDelivery", "fulfillmentTakeaway", "fulfillmentDineIn", "paymentCash", "paymentCardOnSite", "paymentOnline", "deliveryForSomeoneElse", "ordersPaused", "updatedAt")
       VALUES ($1, false, true, true, true, true, false, false, false, now())`,
      [restaurantId],
    );

    await dataSource.query(
      `INSERT INTO menu_categories (id, "restaurantId", name, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Main', 0, now(), now())`,
      [categoryId, restaurantId],
    );

    await dataSource.query(
      `INSERT INTO menu_items (id, "restaurantId", "categoryId", name, price, "isAvailable", "imageUrl", "modifierGroups", "galleryUrls", "galleryWebpUrls", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Burger', 15.00, true, '/x.jpg', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, now(), now())`,
      [menuItemId, restaurantId, categoryId],
    );

    const guestRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `guest-${runId}@e2e.test`,
        password,
        firstName: 'Guest',
        lastName: 'User',
      })
      .expect(201);

    guestToken = (guestRegister.body as { accessToken: string }).accessToken;

    const hallLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `hall-${runId}@e2e.test`, password })
      .expect(201);

    hallToken = (hallLogin.body as { accessToken: string }).accessToken;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('guest creates order, staff lists and accepts', async () => {
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

    const listRes = await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/pre-orders?status=new`)
      .set('Authorization', `Bearer ${hallToken}`)
      .expect(200);

    const items = (listRes.body as { items: Array<{ id: string }> }).items;
    expect(items.some((o) => o.id === orderId)).toBe(true);

    const patchRes = await request(app.getHttpServer())
      .patch(`/restaurants/${restaurantId}/pre-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${hallToken}`)
      .send({ status: PreOrderStatus.ACCEPTED })
      .expect(200);

    expect((patchRes.body as { status: string }).status).toBe(
      PreOrderStatus.ACCEPTED,
    );
  });
});
