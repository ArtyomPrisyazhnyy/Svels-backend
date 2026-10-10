import { MigrationInterface, QueryRunner } from 'typeorm';

export class GUBAddr1791900000000 implements MigrationInterface {
  name = 'GUBAddr1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "guest_addresses" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "restaurantId" uuid NOT NULL, "label" character varying(40), "street" character varying(120) NOT NULL, "house" character varying(20) NOT NULL, "apartment" character varying(20), "entrance" character varying(20), "floor" character varying(20), "intercom" character varying(20), "comment" character varying(300), "lat" numeric(9,6), "lng" numeric(9,6), "isDefault" boolean NOT NULL DEFAULT false, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_guest_addresses" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_addresses_user_restaurant" ON "guest_addresses" ("userId", "restaurantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_guest_addresses_default" ON "guest_addresses" ("userId", "restaurantId") WHERE "isDefault" = true AND "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_guest_addresses_default"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guest_addresses_user_restaurant"`,
    );
    await queryRunner.query(`DROP TABLE "guest_addresses"`);
  }
}
