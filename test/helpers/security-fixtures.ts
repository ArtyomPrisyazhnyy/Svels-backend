import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { insertStaffUser, seedRestaurantBase } from './restaurant-seed';

export const E2E_STAFF_PASSWORD = 'test-pass-12';

export interface VenueStaffTokens {
  owner: string;
  manager: string;
  hall: string;
  production: string;
}

export interface SecurityVenueFixture {
  restaurantId: string;
  menuItemId: string;
  categoryId: string;
}

export async function loginWithEmail(
  app: NestFastifyApplication,
  email: string,
  password = E2E_STAFF_PASSWORD,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);
  return (res.body as { accessToken: string }).accessToken;
}

export async function seedVenueWithStaff(
  dataSource: DataSource,
  runId: string,
  options?: { paymentOnline?: boolean; restaurantName?: string },
): Promise<SecurityVenueFixture> {
  const seeded = await seedRestaurantBase(dataSource, runId, options);
  await insertStaffUser(
    dataSource,
    runId,
    seeded.restaurantId,
    UserRole.RESTAURANT_MANAGER,
    'manager',
  );
  await insertStaffUser(
    dataSource,
    runId,
    seeded.restaurantId,
    UserRole.RESTAURANT_HALL,
    'hall',
  );
  await insertStaffUser(
    dataSource,
    runId,
    seeded.restaurantId,
    UserRole.RESTAURANT_PRODUCTION,
    'production',
  );

  return {
    restaurantId: seeded.restaurantId,
    menuItemId: seeded.menuItemId,
    categoryId: seeded.categoryId,
  };
}

export async function buildStaffTokens(
  app: NestFastifyApplication,
  runId: string,
): Promise<VenueStaffTokens> {
  const ownerEmail = `owner-${runId}@e2e.test`;
  const managerEmail = `manager-${runId}@e2e.test`;
  const hallEmail = `hall-${runId}@e2e.test`;
  const productionEmail = `production-${runId}@e2e.test`;

  const [owner, manager, hall, production] = await Promise.all([
    loginWithEmail(app, ownerEmail),
    loginWithEmail(app, managerEmail),
    loginWithEmail(app, hallEmail),
    loginWithEmail(app, productionEmail),
  ]);

  return { owner, manager, hall, production };
}

export function fillRoutePath(
  template: string,
  restaurantId: string,
  extraIds?: Record<string, string>,
): string {
  const defaults: Record<string, string> = {
    restaurantId,
    id: restaurantId,
    orderId: uuidv7(),
    preOrderId: uuidv7(),
    bookingId: uuidv7(),
    categoryId: uuidv7(),
    itemId: uuidv7(),
    menuItemId: uuidv7(),
    bannerId: uuidv7(),
    linkId: uuidv7(),
    scheduleId: uuidv7(),
    floorPlanId: uuidv7(),
    tableId: uuidv7(),
    locationId: uuidv7(),
    userId: uuidv7(),
    paymentId: uuidv7(),
  };
  const ids = { ...defaults, ...extraIds };
  return template.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    if (ids[key]) {
      return ids[key];
    }
    return uuidv7();
  });
}

/** Test phones: +375 29 000-00-0X (normalized E.164 without spaces). */
/** +375 29 000-00-0X test range (normalized). */
export const E2E_TEST_PHONES = [
  '+3752900000001',
  '+3752900000002',
  '+3752900000003',
  '+3752900000004',
  '+3752900000005',
  '+3752900000006',
  '+3752900000007',
  '+3752900000008',
  '+3752900000009',
  '+3752900000010',
] as const;

/** Digits-only variant accepted by order DTO phone validation. */
export const E2E_ORDER_PHONE = '+375291112233';
