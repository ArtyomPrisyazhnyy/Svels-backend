import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { closeE2eApp, createE2eApp } from './helpers/e2e-app';

const password = 'test-pass-12';
const newPassword = 'new-pass-12-xy';

describe('Auth session invalidation (e2e)', () => {
  let app: NestFastifyApplication;
  const runId = Date.now();
  const email = `session-inv-${runId}@e2e.test`;

  beforeAll(async () => {
    app = await createE2eApp();
  }, 120_000);

  afterAll(async () => {
    await closeE2eApp(app);
  });

  it('rejects old JWT after password change and accepts the new one', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        firstName: 'Session',
        lastName: 'Test',
      })
      .expect(201);

    const oldToken = (registerRes.body as { accessToken: string }).accessToken;

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(200);

    const changeRes = await request(app.getHttpServer())
      .patch('/users/me/password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ password: newPassword })
      .expect(200);

    const newToken = (changeRes.body as { accessToken: string }).accessToken;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);
  });

  it('logout-all invalidates previous tokens and issues a fresh session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(201);

    const tokenBeforeLogout = (loginRes.body as { accessToken: string })
      .accessToken;

    const logoutAllRes = await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${tokenBeforeLogout}`)
      .expect(201);

    const tokenAfterLogout = (logoutAllRes.body as { accessToken: string })
      .accessToken;
    expect(tokenAfterLogout).toBeDefined();
    expect(tokenAfterLogout).not.toBe(tokenBeforeLogout);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${tokenBeforeLogout}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${tokenAfterLogout}`)
      .expect(200);
  });
});
