import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthPwdChangedAt1792100000000 implements MigrationInterface {
  name = 'AuthPwdChangedAt1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordChangedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "passwordChangedAt"`,
    );
  }
}
