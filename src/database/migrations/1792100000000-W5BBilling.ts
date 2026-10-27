import { MigrationInterface, QueryRunner } from 'typeorm';

const PLAN_SITE_ID = '019c2100-0000-7000-8000-000000000001';
const PLAN_APP_ID = '019c2100-0000-7000-8000-000000000002';
const PLAN_COMBO_ID = '019c2100-0000-7000-8000-000000000003';

export class W5BBilling1792100000000 implements MigrationInterface {
  name = 'W5BBilling1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."billing_plans_code_enum" AS ENUM('site', 'app', 'combo')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."billing_subscriptions_status_enum" AS ENUM('trial', 'active', 'past_due', 'suspended', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."billing_invoices_status_enum" AS ENUM('issued', 'paid', 'void')`,
    );

    await queryRunner.query(
      `CREATE TABLE "billing_plans" ("id" uuid NOT NULL, "code" "public"."billing_plans_code_enum" NOT NULL, "name" character varying(128) NOT NULL, "priceMonthlyByn" numeric(10,2) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_billing_plans_code" UNIQUE ("code"), CONSTRAINT "PK_billing_plans" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "billing_subscriptions" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "planId" uuid NOT NULL, "status" "public"."billing_subscriptions_status_enum" NOT NULL DEFAULT 'trial', "trialEndsAt" TIMESTAMP WITH TIME ZONE, "paidUntil" TIMESTAMP WITH TIME ZONE, "pastDueSince" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_billing_subscriptions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_billing_subscriptions_restaurant" ON "billing_subscriptions" ("restaurantId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "billing_invoice_sequences" ("invoiceYear" integer NOT NULL, "lastNumber" integer NOT NULL DEFAULT '0', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_billing_invoice_sequences" PRIMARY KEY ("invoiceYear"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "billing_invoices" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "invoiceYear" integer NOT NULL, "sequenceNumber" integer NOT NULL, "amountByn" numeric(10,2) NOT NULL, "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL, "periodEnd" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."billing_invoices_status_enum" NOT NULL DEFAULT 'issued', "pdfData" bytea, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_billing_invoices" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_billing_invoices_restaurant" ON "billing_invoices" ("restaurantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_billing_invoices_year_number" ON "billing_invoices" ("invoiceYear", "sequenceNumber")`,
    );

    await queryRunner.query(
      `INSERT INTO "billing_plans" ("id", "code", "name", "priceMonthlyByn", "isActive", "createdAt", "updatedAt") VALUES ($1, 'site', 'Сайт', 120.00, true, now(), now())`,
      [PLAN_SITE_ID],
    );
    await queryRunner.query(
      `INSERT INTO "billing_plans" ("id", "code", "name", "priceMonthlyByn", "isActive", "createdAt", "updatedAt") VALUES ($1, 'app', 'Приложение', 150.00, true, now(), now())`,
      [PLAN_APP_ID],
    );
    await queryRunner.query(
      `INSERT INTO "billing_plans" ("id", "code", "name", "priceMonthlyByn", "isActive", "createdAt", "updatedAt") VALUES ($1, 'combo', 'Сайт + приложение', 250.00, true, now(), now())`,
      [PLAN_COMBO_ID],
    );

    await queryRunner.query(
      `INSERT INTO "billing_subscriptions" ("id", "restaurantId", "planId", "status", "trialEndsAt", "paidUntil", "pastDueSince", "createdAt", "updatedAt")
       SELECT
         gen_random_uuid(),
         r.id,
         $1,
         'active',
         NULL,
         (now() AT TIME ZONE 'utc') + interval '1 year',
         NULL,
         now(),
         now()
       FROM restaurants r`,
      [PLAN_SITE_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_billing_invoices_year_number"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_billing_invoices_restaurant"`,
    );
    await queryRunner.query(`DROP TABLE "billing_invoices"`);
    await queryRunner.query(`DROP TABLE "billing_invoice_sequences"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_billing_subscriptions_restaurant"`,
    );
    await queryRunner.query(`DROP TABLE "billing_subscriptions"`);
    await queryRunner.query(`DROP TABLE "billing_plans"`);
    await queryRunner.query(
      `DROP TYPE "public"."billing_invoices_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."billing_subscriptions_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."billing_plans_code_enum"`);
  }
}
