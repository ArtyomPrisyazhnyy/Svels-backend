import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { SubscriptionStatus } from '../src/billing/enums/subscription-status.enum';
import { closeE2eApp, createE2eApp } from './helpers/e2e-app';
import {
  insertSuperAdmin,
  seedRestaurantBase,
} from './helpers/restaurant-seed';

const password = 'test-pass-12';

describe('Billing (e2e)', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;
  const runId = Date.now();

  let restaurantId: string;
  let ownerToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    app = await createE2eApp();
    dataSource = app.get(DataSource);

    const seeded = await seedRestaurantBase(dataSource, runId);
    restaurantId = seeded.restaurantId;

    const superAdmin = await insertSuperAdmin(dataSource, runId);

    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `owner-${runId}@e2e.test`, password })
      .expect(201);
    ownerToken = (ownerLogin.body as { accessToken: string }).accessToken;

    const superLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: superAdmin.email, password })
      .expect(201);
    superAdminToken = (superLogin.body as { accessToken: string }).accessToken;

    await dataSource.query(
      `INSERT INTO billing_subscriptions (id, "restaurantId", "planId", status, "trialEndsAt", "paidUntil", "pastDueSince", "createdAt", "updatedAt")
       VALUES ($1, $2, '019c2100-0000-7000-8000-000000000001', 'active', NULL, now() + interval '30 days', NULL, now(), now())`,
      [uuidv7(), restaurantId],
    );
  });

  afterAll(async () => {
    await closeE2eApp(app);
  });

  it('lists subscriptions for super admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/billing/admin/subscriptions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const body = response.body as Array<{ restaurantId: string }>;
    expect(body.some((row) => row.restaurantId === restaurantId)).toBe(true);
  });

  it('creates invoice, marks paid, and owner downloads PDF', async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/billing/admin/restaurants/${restaurantId}/invoices`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({})
      .expect(201);

    const invoice = createResponse.body as {
      id: string;
      displayNumber: string;
      status: string;
    };
    expect(invoice.status).toBe('issued');
    expect(invoice.displayNumber).toMatch(/^\d{4}-\d{4}$/);

    const markPaid = await request(app.getHttpServer())
      .post(`/billing/admin/invoices/${invoice.id}/mark-paid`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(201);

    const paidBody = markPaid.body as {
      subscription: { status: string; paidUntil: string };
    };
    expect(paidBody.subscription.status).toBe('active');
    expect(paidBody.subscription.paidUntil).toBeTruthy();

    const ownerBilling = await request(app.getHttpServer())
      .get(`/billing/restaurants/${restaurantId}/me`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const ownerBody = ownerBilling.body as {
      invoices: Array<{ id: string; status: string }>;
    };
    expect(ownerBody.invoices[0]?.status).toBe('paid');

    const pdfResponse = await request(app.getHttpServer())
      .get(`/billing/restaurants/${restaurantId}/invoices/${invoice.id}/pdf`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
    expect(Buffer.byteLength(pdfResponse.body as Buffer)).toBeGreaterThan(500);
  });

  it('blocks public menu for suspended venue but allows staff menu access', async () => {
    await dataSource.query(
      `UPDATE billing_subscriptions SET status = $1, "pastDueSince" = now() - interval '30 days', "paidUntil" = now() - interval '30 days' WHERE "restaurantId" = $2`,
      [SubscriptionStatus.SUSPENDED, restaurantId],
    );

    const publicMenu = await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/menu`)
      .expect(503);

    expect((publicMenu.body as { error: string }).error).toBe(
      'VenueTemporarilyUnavailable',
    );

    await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/menu`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
