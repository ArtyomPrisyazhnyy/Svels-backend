import { execSync } from 'node:child_process';

const e2eEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'test',
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_USERNAME: process.env.DB_USERNAME ?? 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD ?? 'postgres',
  DB_NAME: process.env.DB_NAME ?? 'svels',
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: process.env.REDIS_PORT ?? '6379',
  JWT_SECRET: process.env.JWT_SECRET ?? 'change-me-in-production',
  BEPAY_SHOP_ID: process.env.BEPAY_SHOP_ID ?? 'e2e-bepaid-shop',
  BEPAY_SECRET_KEY:
    process.env.BEPAY_SECRET_KEY ?? 'e2e-bepaid-secret-key-local',
  STORAGE_DRIVER: 'local',
};

export default function globalSetup(): void {
  Object.assign(process.env, e2eEnv);
  execSync('npm run migration:run', {
    env: e2eEnv,
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}
