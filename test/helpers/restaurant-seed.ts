import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { AuthProvider } from '../../src/common/enums/auth-provider.enum';
import { RestaurantStatus } from '../../src/common/enums/restaurant-status.enum';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { encryptSecret } from '../../src/common/utils/secret-crypto.util';

export interface SeededRestaurant {
  restaurantId: string;
  ownerId: string;
  menuItemId: string;
  categoryId: string;
}

export interface SeededStaffUsers {
  adminToken?: string;
  hallToken?: string;
  productionToken?: string;
  superAdminToken?: string;
  otherRestaurantAdminToken?: string;
}

export async function seedRestaurantBase(
  dataSource: DataSource,
  runId: number | string,
  options?: {
    ordersPaused?: boolean;
    fulfillmentDelivery?: boolean;
    paymentOnline?: boolean;
    closedSchedule?: boolean;
    restaurantName?: string;
  },
): Promise<SeededRestaurant> {
  const ownerId = uuidv7();
  const restaurantId = uuidv7();
  const categoryId = uuidv7();
  const menuItemId = uuidv7();
  const passwordHash = await bcrypt.hash('test-pass-12', 12);

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
     VALUES ($1, $2, 'Addr 1', $3, $4, now(), now())`,
    [
      restaurantId,
      options?.restaurantName ?? 'E2E Cafe',
      RestaurantStatus.APPROVED,
      ownerId,
    ],
  );

  await dataSource.query(
    `INSERT INTO restaurant_order_settings ("restaurantId", "fulfillmentDelivery", "fulfillmentTakeaway", "fulfillmentDineIn", "paymentCash", "paymentCardOnSite", "paymentOnline", "deliveryForSomeoneElse", "ordersPaused", "updatedAt")
     VALUES ($1, $2, true, true, true, true, $3, false, $4, now())`,
    [
      restaurantId,
      options?.fulfillmentDelivery ?? true,
      options?.paymentOnline ?? false,
      options?.ordersPaused ?? false,
    ],
  );

  if (options?.paymentOnline) {
    const shopId = `shop-${runId}`.slice(0, 64);
    await dataSource.query(
      `INSERT INTO restaurant_payment_settings ("restaurantId", "enabled", "shopId", "secretKeyEncrypted", "testMode", "checkoutTransactionType", "autoCapture", "currency", "updatedAt")
       VALUES ($1, true, $2, $3, true, 'authorization', false, 'BYN', now())`,
      [restaurantId, shopId, encryptSecret('e2e-secret-key')],
    );
  }

  if (!options?.closedSchedule) {
    for (let day = 0; day <= 6; day += 1) {
      await dataSource.query(
        `INSERT INTO work_schedules (id, "restaurantId", "dayOfWeek", "openTime", "closeTime", "isOpen", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, '00:00:00', '23:59:59', true, now(), now())`,
        [uuidv7(), restaurantId, day],
      );
    }
  } else {
    for (let day = 0; day <= 6; day += 1) {
      await dataSource.query(
        `INSERT INTO work_schedules (id, "restaurantId", "dayOfWeek", "openTime", "closeTime", "isOpen", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, '00:00:00', '23:59:59', false, now(), now())`,
        [uuidv7(), restaurantId, day],
      );
    }
  }

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

  return { restaurantId, ownerId, menuItemId, categoryId };
}

export async function insertStaffUser(
  dataSource: DataSource,
  runId: number | string,
  restaurantId: string,
  role: UserRole,
  label: string,
): Promise<{ userId: string; email: string }> {
  const userId = uuidv7();
  const email = `${label}-${runId}@e2e.test`;
  const passwordHash = await bcrypt.hash('test-pass-12', 12);
  await dataSource.query(
    `INSERT INTO users (id, email, phone, "passwordHash", "firstName", "lastName", role, "authProvider", "restaurantId", "createdAt", "updatedAt")
     VALUES ($1, $2, NULL, $3, $4, 'Staff', $5, $6, $7, now(), now())`,
    [
      userId,
      email,
      passwordHash,
      label,
      role,
      AuthProvider.LOCAL,
      restaurantId,
    ],
  );
  return { userId, email };
}

export async function insertSuperAdmin(
  dataSource: DataSource,
  runId: number | string,
): Promise<{ email: string }> {
  const userId = uuidv7();
  const email = `super-${runId}@e2e.test`;
  const passwordHash = await bcrypt.hash('test-pass-12', 12);
  await dataSource.query(
    `INSERT INTO users (id, email, phone, "passwordHash", "firstName", "lastName", role, "authProvider", "restaurantId", "createdAt", "updatedAt")
     VALUES ($1, $2, NULL, $3, 'Super', 'Admin', $4, $5, NULL, now(), now())`,
    [userId, email, passwordHash, UserRole.SUPER_ADMIN, AuthProvider.LOCAL],
  );
  return { email };
}
