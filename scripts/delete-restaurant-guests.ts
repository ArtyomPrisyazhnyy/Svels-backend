import { config } from 'dotenv';
import { Client } from 'pg';

config();

async function main(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'svels',
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    const guestUsers = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'user' AND "restaurantId" IS NOT NULL`,
    );

    const guestIds = guestUsers.rows.map((row) => row.id);

    if (guestIds.length === 0) {
      console.log('Гостевые аккаунты не найдены.');
      await client.query('COMMIT');
      return;
    }

    await client.query(
      `DELETE FROM pre_order_items
       WHERE "preOrderId" IN (
         SELECT id FROM pre_orders WHERE "userId" = ANY($1::uuid[])
       )`,
      [guestIds],
    );

    await client.query(`DELETE FROM pre_orders WHERE "userId" = ANY($1::uuid[])`, [guestIds]);
    await client.query(`DELETE FROM bookings WHERE "userId" = ANY($1::uuid[])`, [guestIds]);

    const deleted = await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [guestIds]);

    await client.query('COMMIT');

    console.log(`Удалено гостевых аккаунтов: ${deleted.rowCount ?? 0}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
