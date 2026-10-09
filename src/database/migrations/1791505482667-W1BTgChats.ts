import { MigrationInterface, QueryRunner } from 'typeorm';

export class W1BTgChats1791505482667 implements MigrationInterface {
  name = 'W1BTgChats1791505482667';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "restaurant_telegram_chats" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "chatId" character varying(32) NOT NULL, "title" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_restaurant_telegram_chats_restaurant_chat" UNIQUE ("restaurantId", "chatId"), CONSTRAINT "PK_81be30ceb1c215b87b219110004" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_telegram_chats_restaurantId" ON "restaurant_telegram_chats"  ("restaurantId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_link_codes" ("codeHash" character varying(64) NOT NULL, "restaurantId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a16cee236c8a3edb3da975dd2d0" PRIMARY KEY ("codeHash"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_link_codes_restaurantId" ON "telegram_link_codes"  ("restaurantId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_order_messages" ("orderId" uuid NOT NULL, "chatId" character varying(32) NOT NULL, "messageId" bigint NOT NULL, CONSTRAINT "PK_9751f024b1011c8b543197a32e5" PRIMARY KEY ("orderId", "chatId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "telegram_order_messages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_telegram_link_codes_restaurantId"`,
    );
    await queryRunner.query(`DROP TABLE "telegram_link_codes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_restaurant_telegram_chats_restaurantId"`,
    );
    await queryRunner.query(`DROP TABLE "restaurant_telegram_chats"`);
  }
}
