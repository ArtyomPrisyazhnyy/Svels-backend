import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { createE2eApp } from './helpers/e2e-app';

describe('Dev endpoints (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('does not expose /dev/* when dev endpoints are disabled', async () => {
    const res = await request(app.getHttpServer())
      .get('/dev/last-otp')
      .expect(404);

    expect(res.text).toContain('Cannot GET');
  });
});
