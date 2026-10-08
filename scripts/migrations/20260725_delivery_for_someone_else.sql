-- Migration: restaurant_order_settings.deliveryForSomeoneElse
--
-- Опция «доставка другому человеку» (имя и телефон получателя в корзине).
-- На dev (synchronize: true) колонка создаётся TypeORM автоматически.
-- На production:
--   psql "$DATABASE_URL" -f scripts/migrations/20260725_delivery_for_someone_else.sql

ALTER TABLE restaurant_order_settings
  ADD COLUMN IF NOT EXISTS "deliveryForSomeoneElse" boolean NOT NULL DEFAULT false;
