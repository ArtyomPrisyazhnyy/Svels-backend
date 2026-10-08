-- Migration: polygon tables (custom-shaped tables)
--
-- Добавляет колонку tables.points (jsonb, nullable) для хранения вершин
-- столов произвольной формы (shape = 'polygon'). Вершины в локальных
-- координатах стола: [x1,y1,x2,y2,...]. Для стандартных форм (rectangle/
-- round/square/oval) остаётся NULL.
--
-- На dev-окружении (synchronize: true) колонка создаётся TypeORM автоматически.
-- На production применять вручную:
--   psql "$DATABASE_URL" -f scripts/migrations/20260706_polygon_tables.sql

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS points jsonb NULL;

-- Расширяем enum table_shape значением 'polygon' (если ещё не добавлено).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'polygon'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_shape_enum')
  ) THEN
    ALTER TYPE table_shape_enum ADD VALUE 'polygon';
  END IF;
END$$;
