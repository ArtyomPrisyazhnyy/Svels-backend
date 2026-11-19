import { MigrationInterface, QueryRunner } from 'typeorm';

export class W5BFlameDisc1792100000000 implements MigrationInterface {
  name = 'W5BFlameDisc1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "subtotalAmount" numeric(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "loyaltyDiscountAmount" numeric(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "loyaltyLevelName" character varying(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "loyaltyLevelId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "loyaltyRewardSnapshot" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "loyaltyRewardSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "loyaltyLevelId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "loyaltyLevelName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "loyaltyDiscountAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "subtotalAmount"`,
    );
  }
}
