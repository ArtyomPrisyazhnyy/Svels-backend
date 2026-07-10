-- Migration: table seats (стулья/диваны/скамейки вокруг столов)
--
-- Добавляет колонку tables.seats (jsonb, nullable) для хранения посадочных
-- мест как дочерних элементов стола. Координаты мест — локальные относительно
-- стола (двигаются/вращаются вместе с ним).
--
-- На dev-окружении (synchronize: true) колонка создаётся TypeORM автоматически.
-- На production применять вручную:
--   psql "$DATABASE_URL" -f scripts/migrations/20260706_table_seats.sql

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS seats jsonb NULL;
