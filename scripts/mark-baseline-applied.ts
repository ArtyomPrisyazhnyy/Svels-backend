import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../src/database/data-source';
import {
  BASELINE_MIGRATION_NAME,
  BASELINE_MIGRATION_TIMESTAMP,
} from '../src/database/baseline-migration.constants';

config();

async function main(): Promise<void> {
  await dataSource.initialize();

  const schemaLog = await dataSource.driver.createSchemaBuilder().log();
  const pendingUp = schemaLog.upQueries.length;
  const pendingDown = schemaLog.downQueries.length;

  if (pendingUp > 0 || pendingDown > 0) {
    console.error(
      'Схема БД не совпадает с entity. Пометка baseline отменена.',
    );
    if (pendingUp > 0) {
      console.error('\n-- Ожидаемые изменения (up):');
      for (const query of schemaLog.upQueries) {
        console.error(query.query);
        if (query.parameters?.length) {
          console.error('  params:', query.parameters);
        }
      }
    }
    if (pendingDown > 0) {
      console.error('\n-- Лишнее в БД относительно entity (down):');
      for (const query of schemaLog.downQueries) {
        console.error(query.query);
      }
    }
    await dataSource.destroy();
    process.exit(1);
  }

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" SERIAL NOT NULL,
      "timestamp" bigint NOT NULL,
      "name" character varying NOT NULL,
      CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id")
    )
  `);

  const existing: Array<{ id: number }> = await queryRunner.query(
    `SELECT "id" FROM "migrations" WHERE "timestamp" = $1 AND "name" = $2 LIMIT 1`,
    [BASELINE_MIGRATION_TIMESTAMP, BASELINE_MIGRATION_NAME],
  );

  if (existing.length > 0) {
    console.log(
      `Baseline уже помечен (migrations.id=${existing[0].id}, ${BASELINE_MIGRATION_NAME}).`,
    );
  } else {
    await queryRunner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`,
      [BASELINE_MIGRATION_TIMESTAMP, BASELINE_MIGRATION_NAME],
    );
    console.log(`Baseline помечен как применённый: ${BASELINE_MIGRATION_NAME}`);
  }

  await queryRunner.release();
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
