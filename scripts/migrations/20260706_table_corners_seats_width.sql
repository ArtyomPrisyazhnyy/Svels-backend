-- Migration: table cornerRadius + seat width
--
-- tables.cornerRadius — радиус скругления углов прямоугольных/квадратных столов.
-- table_seats.width — ширина места (для диванов/скамеек), хранится внутри JSONB seats.
--
-- На dev-окружении (synchronize: true) колонка создаётся TypeORM автоматически.
-- На production применять вручную:
--   psql "$DATABASE_URL" -f scripts/migrations/20260706_table_corners_seats_width.sql

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS "cornerRadius" float NOT NULL DEFAULT 6;
