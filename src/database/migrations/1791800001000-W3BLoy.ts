import { MigrationInterface, QueryRunner } from 'typeorm';

export class W3BLoy1791800001000 implements MigrationInterface {
  name = 'W3BLoy1791800001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "loyalty_visits" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "userId" uuid NOT NULL, "orderId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_loyalty_visits_orderId" UNIQUE ("orderId"), CONSTRAINT "PK_loyalty_visits" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loyalty_visits_restaurant_user" ON "loyalty_visits" ("restaurantId", "userId")`,
    );
    await queryRunner.query(
      `CREATE TABLE "guest_loyalty_balances" ("restaurantId" uuid NOT NULL, "userId" uuid NOT NULL, "visits" integer NOT NULL DEFAULT 0, "totalVisits" integer NOT NULL DEFAULT 0, "lastVisitAt" TIMESTAMP WITH TIME ZONE, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_guest_loyalty_balances" PRIMARY KEY ("restaurantId", "userId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "guest_loyalty_balances"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_loyalty_visits_restaurant_user"`,
    );
    await queryRunner.query(`DROP TABLE "loyalty_visits"`);
  }
}
