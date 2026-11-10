import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImgVariants1792100000000 implements MigrationInterface {
  name = 'ImgVariants1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD "imageVariants" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_items" DROP COLUMN "imageVariants"`,
    );
  }
}
