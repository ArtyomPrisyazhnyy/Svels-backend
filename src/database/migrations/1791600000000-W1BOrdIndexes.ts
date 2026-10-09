import { MigrationInterface, QueryRunner } from 'typeorm';

export class W1BOrdIndexes1791600000000 implements MigrationInterface {
  name = 'W1BOrdIndexes1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pre_orders_restaurant_created_at" ON "pre_orders" ("restaurantId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pre_orders_restaurant_updated_at" ON "pre_orders" ("restaurantId", "updatedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pre_orders_restaurant_updated_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pre_orders_restaurant_created_at"`,
    );
  }
}
