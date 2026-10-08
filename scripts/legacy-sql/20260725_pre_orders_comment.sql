-- Migration: pre_orders.comment
--
-- Комментарий к заказу (длинный текст — Postgres `text`, не varchar).
-- На dev (synchronize: true) колонка создаётся TypeORM автоматически.
-- На production:
--   psql "$DATABASE_URL" -f scripts/migrations/20260725_pre_orders_comment.sql

ALTER TABLE pre_orders
  ADD COLUMN IF NOT EXISTS "comment" text NULL;
