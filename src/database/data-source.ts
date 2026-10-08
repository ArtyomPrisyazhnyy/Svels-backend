import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { UuidV7Subscriber } from './uuid-v7.subscriber';
import { resolvePostgresConnection } from './pg-connection';

config();

const connection = resolvePostgresConnection();

export default new DataSource({
  type: 'postgres',
  ...(connection.url
    ? { url: connection.url }
    : {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        database: connection.database,
      }),
  ssl: connection.ssl,
  extra: {
    connectionTimeoutMillis: 20_000,
  },
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: [UuidV7Subscriber],
  synchronize: false,
  migrationsRun: false,
});
