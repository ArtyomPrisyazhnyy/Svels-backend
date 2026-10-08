import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { Client } from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { toPgClientConfig } from '../src/database/pg-connection';

config();

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const email = (
    readArg('--email') ??
    process.env.SUPER_ADMIN_EMAIL ??
    process.argv[2]
  )?.toLowerCase();

  const password =
    readArg('--password') ?? process.env.SUPER_ADMIN_PASSWORD ?? process.argv[3];

  const firstName =
    readArg('--first-name') ?? process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super';

  const lastName =
    readArg('--last-name') ?? process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin';

  if (!email || !password) {
    console.error(`
Создание суперадминистратора платформы Svels.

Использование:
  npm run create:super-admin -- --email admin@example.com --password "secret123"
  npm run create:super-admin -- admin@example.com secret123

Или задайте в .env:
  SUPER_ADMIN_EMAIL=
  SUPER_ADMIN_PASSWORD=
  SUPER_ADMIN_FIRST_NAME=   (необязательно)
  SUPER_ADMIN_LAST_NAME=    (необязательно)
`);
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Ошибка: пароль должен быть не короче 8 символов.');
    process.exit(1);
  }

  const client = new Client(toPgClientConfig());

  await client.connect();

  try {
    const existingSuper = await client.query<{ email: string }>(
      `SELECT email FROM users WHERE role = 'super_admin' LIMIT 1`,
    );

    if (existingSuper.rowCount) {
      const existingEmail = existingSuper.rows[0].email;
      if (existingEmail === email) {
        console.log(`Суперадминистратор уже существует: ${email}`);
        return;
      }

      console.error(
        `Ошибка: суперадминистратор уже создан (${existingEmail}). ` +
          'Используйте этот аккаунт или удалите его вручную в БД.',
      );
      process.exit(1);
    }

    const existingByEmail = await client.query<{ role: string }>(
      `SELECT role FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );

    if (existingByEmail.rowCount) {
      console.error(
        `Ошибка: пользователь ${email} уже существует с ролью ${existingByEmail.rows[0].role}.`,
      );
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv7();

    await client.query(
      `INSERT INTO users (
        id, email, "passwordHash", "firstName", "lastName",
        role, "authProvider", "googleId", "restaurantId",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        'super_admin', 'local', NULL, NULL,
        NOW(), NOW()
      )`,
      [id, email, passwordHash, firstName, lastName],
    );

    console.log(`Суперадминистратор создан: ${email}`);
    console.log('Войдите через /auth/guest — откроется панель суперадмина.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Не удалось создать суперадминистратора:', error);
  process.exit(1);
});
