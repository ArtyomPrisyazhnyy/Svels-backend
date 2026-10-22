import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Конвертирует сохранённые публичные URL медиа в object keys.
 * Перед применением на production сделайте бэкап БД.
 */
export class W5BStorageKeys1792100000000 implements MigrationInterface {
  name = 'W5BStorageKeys1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION strip_media_storage_key(val text) RETURNS text AS $$
      DECLARE
        trimmed text;
        path_only text;
      BEGIN
        IF val IS NULL OR btrim(val) = '' THEN
          RETURN val;
        END IF;

        trimmed := btrim(val);

        IF trimmed LIKE '/uploads/%' THEN
          RETURN regexp_replace(trimmed, '^/+uploads/+', '');
        END IF;

        IF trimmed ~ '^https?://storage\\.yandexcloud\\.net/[^/]+/' THEN
          RETURN regexp_replace(trimmed, '^https?://storage\\.yandexcloud\\.net/[^/]+/', '');
        END IF;

        IF trimmed ~ '^https?://' THEN
          path_only := regexp_replace(trimmed, '^https?://[^/]+/', '');
          path_only := regexp_replace(path_only, '^/+', '');
          RETURN path_only;
        END IF;

        RETURN regexp_replace(trimmed, '^/+', '');
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    const scalarColumns: Array<{ table: string; columns: string[] }> = [
      {
        table: 'menu_items',
        columns: ['imageUrl', 'imageWebpUrl'],
      },
      {
        table: 'restaurant_promo_banners',
        columns: ['imageUrl', 'imageWebpUrl'],
      },
      {
        table: 'restaurants',
        columns: ['logoUrl', 'logoWebpUrl'],
      },
    ];

    for (const { table, columns } of scalarColumns) {
      for (const column of columns) {
        await queryRunner.query(`
          UPDATE "${table}"
          SET "${column}" = strip_media_storage_key("${column}")
          WHERE "${column}" IS NOT NULL
            AND (
              "${column}" LIKE '/uploads/%'
              OR "${column}" ~ '^https?://'
            );
        `);
      }
    }

    const jsonColumns: Array<{ table: string; column: string }> = [
      { table: 'menu_items', column: 'galleryUrls' },
      { table: 'menu_items', column: 'galleryWebpUrls' },
    ];

    for (const { table, column } of jsonColumns) {
      await queryRunner.query(`
        UPDATE "${table}" AS t
        SET "${column}" = COALESCE(
          (
            SELECT jsonb_agg(to_jsonb(strip_media_storage_key(elem)))
            FROM jsonb_array_elements_text(t."${column}") AS elem
          ),
          '[]'::jsonb
        )
        WHERE jsonb_typeof(t."${column}") = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(t."${column}") AS elem
            WHERE elem LIKE '/uploads/%' OR elem ~ '^https?://'
          );
      `);
    }

    await queryRunner.query(
      `DROP FUNCTION IF EXISTS strip_media_storage_key(text);`,
    );
  }

  public down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    // Не восстанавливаем полные URL — ключи остаются в БД.
    return Promise.resolve();
  }
}
