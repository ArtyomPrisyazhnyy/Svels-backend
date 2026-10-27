import { MigrationInterface, QueryRunner } from 'typeorm';

export class W4BDlvZones1792100000000 implements MigrationInterface {
  name = 'W4BDlvZones1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."delivery_zones_type_enum" AS ENUM('radius', 'polygon')`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_zones" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "locationId" uuid NOT NULL, "name" character varying(120) NOT NULL, "type" "public"."delivery_zones_type_enum" NOT NULL, "radiusMeters" integer, "polygon" jsonb, "deliveryFee" numeric(10,2) NOT NULL, "minOrder" numeric(10,2) NOT NULL, "freeDeliveryFrom" numeric(10,2), "isActive" boolean NOT NULL DEFAULT true, "priority" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_delivery_zones" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_zones_location_active" ON "delivery_zones" ("locationId", "isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_zones_restaurant" ON "delivery_zones" ("restaurantId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "itemsSubtotal" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "deliveryFee" numeric(10,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ADD "deliveryZoneId" uuid`,
    );
    await queryRunner.query(
      `UPDATE "pre_orders" SET "itemsSubtotal" = "totalAmount" WHERE "itemsSubtotal" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" ALTER COLUMN "itemsSubtotal" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "deliveryZoneId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "deliveryFee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_orders" DROP COLUMN "itemsSubtotal"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_delivery_zones_restaurant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_delivery_zones_location_active"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_zones"`);
    await queryRunner.query(`DROP TYPE "public"."delivery_zones_type_enum"`);
  }
}
