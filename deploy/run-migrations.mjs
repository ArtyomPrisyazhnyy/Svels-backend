import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function resolvePostgresConnection() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return { url, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined };
  }
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'svels',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  };
}

const connection = resolvePostgresConnection();

const dataSource = new DataSource({
  type: 'postgres',
  ...(connection.url
    ? { url: connection.url, ssl: connection.ssl }
    : {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        database: connection.database,
        ssl: connection.ssl,
      }),
  entities: [join(rootDir, 'dist/**/*.entity.js')],
  migrations: [join(rootDir, 'dist/database/migrations/*.js')],
  synchronize: false,
  migrationsRun: false,
});

await dataSource.initialize();
await dataSource.runMigrations();
await dataSource.destroy();
console.log('Migrations applied');
