-- Migration: add menu_items.oldPrice (optional struck-through previous price)
--
-- На dev-окружении (synchronize: true) колонка добавится TypeORM автоматически.
-- На production применять вручную:
--   psql "$DATABASE_URL" -f scripts/migrations/20260723_add_menu_item_old_price.sql

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS "oldPrice" numeric(10, 2) NULL;
