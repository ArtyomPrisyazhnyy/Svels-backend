import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { createE2eApp } from './helpers/e2e-app';

describe('Dev endpoints enabled (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('exposes /dev/last-otp when NODE_ENV=development and ENABLE_DEV_ENDPOINTS=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/dev/last-otp')
      .expect(400);

    expect((res.body as { message: string | string[] }).message).toContain(
      'phone is required',
    );
  });
});
