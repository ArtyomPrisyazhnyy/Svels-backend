-- Migration: remove restaurant_styling.headerLayout
--
-- Логотип в шапке всегда слева; настройка расположения удалена из продукта.
--
-- На dev-окружении (synchronize: true) колонка удалится TypeORM автоматически.
-- На production применять вручную:
--   psql "$DATABASE_URL" -f scripts/migrations/20260708_drop_header_layout.sql

ALTER TABLE restaurant_styling
  DROP COLUMN IF EXISTS "headerLayout";

DROP TYPE IF EXISTS restaurant_styling_headerlayout_enum;
