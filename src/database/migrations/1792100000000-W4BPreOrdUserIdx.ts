import { MigrationInterface, QueryRunner } from 'typeorm';

export class W4BPreOrdUserIdx1792100000000 implements MigrationInterface {
  name = 'W4BPreOrdUserIdx1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pre_orders_user_created_at" ON "pre_orders" ("userId", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pre_orders_user_restaurant_created_at" ON "pre_orders" ("userId", "restaurantId", "createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pre_orders_user_restaurant_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pre_orders_user_created_at"`,
    );
  }
}
