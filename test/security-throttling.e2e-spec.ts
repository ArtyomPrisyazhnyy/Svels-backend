import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { closeE2eApp } from './helpers/e2e-app';
import { E2E_TEST_PHONES } from './helpers/security-fixtures';
import { seedRestaurantBase } from './helpers/restaurant-seed';
import { SmsRouterService } from '../src/otp/providers/sms-router.service';
import { ThrottleLimits } from '../src/common/utils/throttle-limits.util';

describe('Security throttling (e2e, production limits)', () => {
  let app: NestFastifyApplication;
  let restaurantId: string;
  const runId = Date.now();

  beforeAll(async () => {
    expect(ThrottleLimits.authLogin.default.limit).toBe(10);

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SmsRouterService)
      .useValue({
        sendOtp: () => Promise.resolve({ ok: true, provider: 'dev' }),
      })
      .compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
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
    const seeded = await seedRestaurantBase(dataSource, `thr-${runId}`);
    restaurantId = seeded.restaurantId;
  }, 120_000);

  afterAll(async () => {
    await closeE2eApp(app);
  });

  it('throttles auth login', async () => {
    const email = `nouser-${runId}@e2e.test`;
    let saw429 = false;
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password' });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });

  it('throttles auth register', async () => {
    let saw429 = false;
    for (let i = 0; i < 8; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `reg-${runId}-${i}@e2e.test`,
          password: 'test-pass-12',
          firstName: 'A',
          lastName: 'B',
        });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });

  it('throttles OTP verify', async () => {
    const phone = E2E_TEST_PHONES[3];
    let saw429 = false;
    for (let i = 0; i < 15; i += 1) {
      const res = await request(app.getHttpServer())
        .post(`/restaurants/${restaurantId}/auth/otp/verify`)
        .send({ phone, code: '0000' });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });

  it('throttles OTP send', async () => {
    let saw429 = false;
    for (let i = 0; i < 8; i += 1) {
      const res = await request(app.getHttpServer())
        .post(`/restaurants/${restaurantId}/auth/otp/send`)
        .send({ phone: E2E_TEST_PHONES[4 + (i % 3)] });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });
});
