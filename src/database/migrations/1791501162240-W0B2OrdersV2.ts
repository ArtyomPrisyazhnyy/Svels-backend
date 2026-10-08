import { MigrationInterface, QueryRunner } from 'typeorm';

export class W0B2OrdersV21791501162240 implements MigrationInterface {
  name = 'W0B2OrdersV21791501162240';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurant_order_settings" ADD "ordersPaused" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_order_items" ADD "modifiers" jsonb NOT NULL DEFAULT '[]'`,
    );

    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "orderNumber" integer`,
    );
    await queryRunner.query(`
      WITH numbered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "restaurantId"
            ORDER BY "createdAt" ASC
          ) AS rn
        FROM "pre_orders"
      )
      UPDATE "pre_orders" po
      SET "orderNumber" = numbered.rn
      FROM numbered
      WHERE po.id = numbered.id
    `);
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "orderNumber" SET NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."pre_orders_paymentstatus_enum" AS ENUM('not_required', 'pending', 'authorized', 'paid', 'voided', 'failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "paymentStatus" "public"."pre_orders_paymentstatus_enum" NOT NULL DEFAULT 'not_required'`,
    );
    await queryRunner.query(`
      UPDATE "pre_orders"
      SET "paymentStatus" = CASE
        WHEN "paymentMethod"::text != 'online' THEN 'not_required'::"public"."pre_orders_paymentstatus_enum"
        WHEN "status"::text = 'pending' THEN 'pending'::"public"."pre_orders_paymentstatus_enum"
        WHEN "status"::text = 'confirmed' THEN 'authorized'::"public"."pre_orders_paymentstatus_enum"
        WHEN "status"::text = 'paid' THEN 'paid'::"public"."pre_orders_paymentstatus_enum"
        WHEN "status"::text = 'cancelled' THEN 'voided'::"public"."pre_orders_paymentstatus_enum"
        ELSE 'pending'::"public"."pre_orders_paymentstatus_enum"
      END
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."pre_orders_fulfillmenttype_enum" AS ENUM('delivery', 'takeaway', 'dine_in')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "fulfillmentType" "public"."pre_orders_fulfillmenttype_enum" NOT NULL DEFAULT 'takeaway'`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "customerName" character varying(120) NOT NULL DEFAULT 'Гость'`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "customerPhone" character varying(32) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "recipientName" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "recipientPhone" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "deliveryAddress" jsonb`,
    );
    await queryRunner.query(`ALTER TABLE "pre_orders" ADD "locationId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "requestedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "cancelReason" character varying(300)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "statusChangedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`
      UPDATE "pre_orders"
      SET "statusChangedAt" = COALESCE("updatedAt", "createdAt")
    `);
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "statusChangedAt" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."pre_orders_status_enum" RENAME TO "pre_orders_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pre_orders_status_enum" AS ENUM('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "pre_orders"
      ALTER COLUMN "status" TYPE "public"."pre_orders_status_enum"
      USING (
        CASE "status"::text
          WHEN 'pending' THEN 'new'
          WHEN 'confirmed' THEN 'new'
          WHEN 'paid' THEN 'new'
          WHEN 'cancelled' THEN 'cancelled'
          ELSE 'new'
        END
      )::"public"."pre_orders_status_enum"
    `);
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "status" SET DEFAULT 'new'`,
    );
    await queryRunner.query(`DROP TYPE "public"."pre_orders_status_enum_old"`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pre_orders_restaurant_order_number" ON "pre_orders" ("restaurantId", "orderNumber")`,
    );

    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "fulfillmentType" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "customerName" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "customerPhone" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_pre_orders_restaurant_order_number"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."pre_orders_status_enum_old" AS ENUM('pending', 'confirmed', 'paid', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "pre_orders"
      ALTER COLUMN "status" TYPE "public"."pre_orders_status_enum_old"
      USING (
        CASE "status"::text
          WHEN 'cancelled' THEN 'cancelled'
          WHEN 'new' THEN 'pending'
          WHEN 'accepted' THEN 'confirmed'
          WHEN 'preparing' THEN 'confirmed'
          WHEN 'ready' THEN 'confirmed'
          WHEN 'completed' THEN 'paid'
          ELSE 'pending'
        END
      )::"public"."pre_orders_status_enum_old"
    `);
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."pre_orders_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."pre_orders_status_enum_old" RENAME TO "pre_orders_status_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "statusChangedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "cancelReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "requestedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "locationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "deliveryAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "recipientPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "recipientName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "customerPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "customerName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "fulfillmentType"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."pre_orders_fulfillmenttype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "paymentStatus"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."pre_orders_paymentstatus_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "orderNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_order_items" DROP COLUMN "modifiers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurant_order_settings" DROP COLUMN "ordersPaused"`,
    );
  }
}
