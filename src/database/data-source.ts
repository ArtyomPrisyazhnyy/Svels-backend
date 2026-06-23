import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { UuidV7Subscriber } from './uuid-v7.subscriber';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'svels',
  entities: ['src/**/*.entity.ts'],
  subscribers: [UuidV7Subscriber],
  synchronize: false,
});
