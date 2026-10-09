import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHmac } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createE2eApp } from './helpers/e2e-app';
import { seedRestaurantBase } from './helpers/restaurant-seed';

const BOT_TOKEN = '123:TEST';

interface AuthBody {
  accessToken: string;
  user: { id: string; role: string; restaurantId: string };
}

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

describe('Telegram WebApp guest auth (e2e)', () => {
  let app: NestFastifyApplication;
  let restaurantId: string;
  let previousBotToken: string | undefined;
  const runId = Date.now();
  const telegramUser = {
    id: 424242001,
    first_name: 'Anna',
    last_name: 'Guest',
  };

  beforeAll(async () => {
    previousBotToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;

    app = await createE2eApp();
    const seeded = await seedRestaurantBase(app.get(DataSource), runId, {
      restaurantName: 'TG Mini App Cafe',
    });
    restaurantId = seeded.restaurantId;
  });

  afterAll(async () => {
    await app?.close();
    if (previousBotToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = previousBotToken;
    }
  });

  it('logs in a new guest from valid initData', async () => {
    const res = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/telegram`)
      .send({ initData: signInitData(telegramUser) })
      .expect(200);

    const body = res.body as AuthBody;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user.role).toBe('user');
    expect(body.user.restaurantId).toBe(restaurantId);
  });

  it('returns the same guest on repeated login', async () => {
    const first = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/telegram`)
      .send({ initData: signInitData(telegramUser) })
      .expect(200);
    const second = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/telegram`)
      .send({ initData: signInitData(telegramUser) })
      .expect(200);

    const firstBody = first.body as AuthBody;
    const secondBody = second.body as AuthBody;
    expect(secondBody.user.id).toBe(firstBody.user.id);
  });

  it('rejects initData with a wrong hash', async () => {
    const initData = signInitData(telegramUser).replace(
      /hash=[0-9a-f]{64}/,
      `hash=${'0'.repeat(64)}`,
    );

    const res = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/telegram`)
      .send({ initData })
      .expect(401);

    expect((res.body as { code: string }).code).toBe(
      'TELEGRAM_INIT_DATA_INVALID',
    );
  });
});
