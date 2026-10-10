import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHmac } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserRole } from '../src/common/enums/user-role.enum';
import { createE2eApp } from './helpers/e2e-app';
import { insertStaffUser, seedRestaurantBase } from './helpers/restaurant-seed';

const password = 'test-pass-12';
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
  telegramUser: { id: number; first_name: string; last_name?: string },
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`/restaurants/${restaurantId}/auth/telegram`)
    .send({ initData: signInitData(telegramUser) })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}

interface GuestAddressBody {
  id: string;
  street: string;
  house: string;
  apartment: string | null;
  isDefault: boolean;
}

describe('Guest addresses (e2e)', () => {
  let app: NestFastifyApplication;
  const runId = Date.now();

  let restaurantId: string;
  let menuItemId: string;
  let guestToken: string;
  let guest2Token: string;
  let hallToken: string;
  let otherRestaurantGuestToken: string;
  let addressId: string;
  let previousBotToken: string | undefined;

  beforeAll(async () => {
    previousBotToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;

    app = await createE2eApp();
    const dataSource = app.get(DataSource);
    const seeded = await seedRestaurantBase(dataSource, `addr-${runId}`, {
      fulfillmentDelivery: true,
    });
    restaurantId = seeded.restaurantId;
    menuItemId = seeded.menuItemId;

    const hall = await insertStaffUser(
      dataSource,
      runId,
      restaurantId,
      UserRole.RESTAURANT_HALL,
      'hall',
    );

    guestToken = await loginTelegramGuest(app, restaurantId, {
      id: 900_000_001,
      first_name: 'Addr',
      last_name: 'One',
    });
    guest2Token = await loginTelegramGuest(app, restaurantId, {
      id: 900_000_002,
      first_name: 'Addr',
      last_name: 'Two',
    });

    const otherRestaurant = await seedRestaurantBase(
      dataSource,
      `addr-other-${runId}`,
      { restaurantName: 'Other Addr Cafe' },
    );
    otherRestaurantGuestToken = await loginTelegramGuest(
      app,
      otherRestaurant.restaurantId,
      { id: 900_000_003, first_name: 'Other', last_name: 'Venue' },
    );

    const hallLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: hall.email, password })
      .expect(201);
    hallToken = (hallLogin.body as { accessToken: string }).accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    if (previousBotToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = previousBotToken;
    }
  });

  const basePath = () => `/restaurants/${restaurantId}/me/addresses`;

  it('CRUD flow for restaurant guest', async () => {
    const createRes = await request(app.getHttpServer())
      .post(basePath())
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ label: 'Дом', street: 'Ленина', house: '10', apartment: '2' })
      .expect(201);

    const created = createRes.body as GuestAddressBody;
    addressId = created.id;
    expect(created.isDefault).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get(basePath())
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);
    expect((listRes.body as GuestAddressBody[])[0].id).toBe(addressId);

    await request(app.getHttpServer())
      .patch(`${basePath()}/${addressId}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ comment: 'Звонить' })
      .expect(200);

    const secondRes = await request(app.getHttpServer())
      .post(basePath())
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ street: 'Пушкина', house: '1' })
      .expect(201);
    const secondId = (secondRes.body as GuestAddressBody).id;

    await request(app.getHttpServer())
      .post(`${basePath()}/${secondId}/default`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    const listAfterDefault = await request(app.getHttpServer())
      .get(basePath())
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);
    expect((listAfterDefault.body as GuestAddressBody[])[0].id).toBe(secondId);
  });

  it('returns 404 when another guest patches or deletes', async () => {
    await request(app.getHttpServer())
      .patch(`${basePath()}/${addressId}`)
      .set('Authorization', `Bearer ${guest2Token}`)
      .send({ house: '99' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`${basePath()}/${addressId}`)
      .set('Authorization', `Bearer ${guest2Token}`)
      .expect(404);
  });

  it('returns 403 for guest from another restaurant', async () => {
    await request(app.getHttpServer())
      .get(basePath())
      .set('Authorization', `Bearer ${otherRestaurantGuestToken}`)
      .expect(403);
  });

  it('reassigns default to most recently used address after delete', async () => {
    const first = await request(app.getHttpServer())
      .post(basePath())
      .set('Authorization', `Bearer ${guest2Token}`)
      .send({ street: 'Старая', house: '1' })
      .expect(201);
    const firstId = (first.body as GuestAddressBody).id;

    const second = await request(app.getHttpServer())
      .post(basePath())
      .set('Authorization', `Bearer ${guest2Token}`)
      .send({ street: 'Новая', house: '2' })
      .expect(201);
    const secondId = (second.body as GuestAddressBody).id;

    await request(app.getHttpServer())
      .post(`${basePath()}/${secondId}/default`)
      .set('Authorization', `Bearer ${guest2Token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`${basePath()}/${secondId}`)
      .set('Authorization', `Bearer ${guest2Token}`)
      .expect(204);

    const listRes = await request(app.getHttpServer())
      .get(basePath())
      .set('Authorization', `Bearer ${guest2Token}`)
      .expect(200);
    const list = listRes.body as GuestAddressBody[];
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(firstId);
    expect(list[0].isDefault).toBe(true);
  });

  it('returns 403 for staff role', async () => {
    await request(app.getHttpServer())
      .get(basePath())
      .set('Authorization', `Bearer ${hallToken}`)
      .expect(403);
  });

  it('keeps order delivery snapshot when saved address is edited', async () => {
    const addrRes = await request(app.getHttpServer())
      .post(basePath())
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ street: 'Снимок', house: '7' })
      .expect(201);
    const snapshotAddressId = (addrRes.body as GuestAddressBody).id;

    const orderRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/pre-orders`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        fulfillmentType: 'delivery',
        paymentMethod: 'cash',
        items: [{ menuItemId, quantity: 1 }],
        customerName: 'Гость',
        customerPhone: '+375290000001',
        addressId: snapshotAddressId,
      })
      .expect(201);

    const orderId = (orderRes.body as { id: string }).id;
    expect(orderRes.body).toMatchObject({
      deliveryAddress: { street: 'Снимок', house: '7' },
    });

    await request(app.getHttpServer())
      .patch(`${basePath()}/${snapshotAddressId}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ street: 'Изменено', house: '99' })
      .expect(200);

    const orderAgain = await request(app.getHttpServer())
      .get(`/users/me/pre-orders/${orderId}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(orderAgain.body).toMatchObject({
      deliveryAddress: { street: 'Снимок', house: '7' },
    });
  });
});
