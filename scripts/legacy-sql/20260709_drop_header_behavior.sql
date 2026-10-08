-- Migration: remove restaurant_styling.headerBehavior
--
-- Шапка всегда закреплена сверху; настройка скрытия при прокрутке удалена.
--
-- На dev-окружении (synchronize: true) колонка удалится TypeORM автоматически.
-- На production применять вручную:
--   psql "$DATABASE_URL" -f scripts/migrations/20260709_drop_header_behavior.sql

ALTER TABLE restaurant_styling
  DROP COLUMN IF EXISTS "headerBehavior";

DROP TYPE IF EXISTS restaurant_styling_headerbehavior_enum;
