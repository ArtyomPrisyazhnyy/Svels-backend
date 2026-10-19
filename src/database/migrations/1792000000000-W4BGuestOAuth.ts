import { MigrationInterface, QueryRunner } from 'typeorm';

export class W4BGuestOAuth1792000000000 implements MigrationInterface {
  name = 'W4BGuestOAuth1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."guest_oauth_identities_provider_enum" AS ENUM('google', 'apple')`,
    );
    await queryRunner.query(
      `CREATE TABLE "guest_oauth_identities" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "restaurantId" uuid NOT NULL, "provider" "public"."guest_oauth_identities_provider_enum" NOT NULL, "providerSubject" character varying(255) NOT NULL, "email" character varying(320) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_guest_oauth_identities" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_guest_oauth_identities_restaurant_provider_subject" ON "guest_oauth_identities" ("restaurantId", "provider", "providerSubject")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_oauth_identities_user" ON "guest_oauth_identities" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_oauth_identities" ADD CONSTRAINT "FK_guest_oauth_identities_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_oauth_identities" ADD CONSTRAINT "FK_guest_oauth_identities_restaurantId" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guest_oauth_identities" DROP CONSTRAINT "FK_guest_oauth_identities_restaurantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_oauth_identities" DROP CONSTRAINT "FK_guest_oauth_identities_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guest_oauth_identities_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guest_oauth_identities_restaurant_provider_subject"`,
    );
    await queryRunner.query(`DROP TABLE "guest_oauth_identities"`);
    await queryRunner.query(
      `DROP TYPE "public"."guest_oauth_identities_provider_enum"`,
    );
  }
}
