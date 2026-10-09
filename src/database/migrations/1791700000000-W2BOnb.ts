import { MigrationInterface, QueryRunner } from 'typeorm';

export class W2BOnb1791700000000 implements MigrationInterface {
  name = 'W2BOnb1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "legalName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "legalAddress" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "contactPhone" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD "contactEmail" character varying`,
    );
    await queryRunner.query(
      `CREATE TABLE "password_set_tokens" ("tokenHash" character varying(64) NOT NULL, "userId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_password_set_tokens" PRIMARY KEY ("tokenHash"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_password_set_tokens_userId" ON "password_set_tokens" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_password_set_tokens_userId"`,
    );
    await queryRunner.query(`DROP TABLE "password_set_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "contactEmail"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "contactPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "legalAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN "legalName"`,
    );
  }
}
