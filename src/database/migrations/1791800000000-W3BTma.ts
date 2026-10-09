import { MigrationInterface, QueryRunner } from 'typeorm';

export class W3BTma1791800000000 implements MigrationInterface {
  name = 'W3BTma1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "telegram_guest_links" ("restaurantId" uuid NOT NULL, "telegramUserId" character varying(32) NOT NULL, "userId" uuid NOT NULL, "telegramUsername" character varying(64), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_telegram_guest_links_userId" UNIQUE ("userId"), CONSTRAINT "PK_telegram_guest_links" PRIMARY KEY ("restaurantId", "telegramUserId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "telegram_guest_links"`);
  }
}
