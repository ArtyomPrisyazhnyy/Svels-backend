-- Migration: floor-plan constructor + booking slot exclusion
--
-- Требуется для:
--   1) поддержки EXCLUDE-ограничения на пересечение слотов броней одного стола
--      (Postgres нативно запрещает двум броням пересекаться по времени на одном столе);
--   2) корректной работы gist-индексов на range-типах.
--
-- Запускать один раз на production-базе после применения TypeORM synchronize / миграций схемы:
--   psql "$DATABASE_URL" -f scripts/migrations/20260705_floor_plan_constructor.sql
--
-- На dev-окружении (synchronize: true) столбцы создаются TypeORM автоматически,
-- но EXCLUDE-ограничение нужно создать вручную этой миграцией.

-- 1. Расширение btree_gist: позволяет gist-индексам работать со скалярными типами (uuid)
--    в комбинации с range-типами (tstzrange).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. EXCLUDE-ограничение: запрещает две активные брони одного стола с пересекающимся
--    окном [slotStart, slotEnd). Гарантирует race-safety на уровне БД даже при отказе Redis.
--    Учитываем только активные брони (status <> 'cancelled' AND status <> 'completed').
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_table_slot_excl;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_table_slot_excl
  EXCLUDE USING gist (
    tableId WITH =,
    tstzrange(slotStart, slotEnd) WITH &&
  )
  WHERE (tableId IS NOT NULL
         AND status <> 'cancelled'
         AND status <> 'completed');

-- 3. Оптимизационный индекс для выборки броней по столу и окну (используется в getAvailability).
CREATE INDEX IF NOT EXISTS idx_bookings_table_slot
  ON bookings USING gist (tableId, tstzrange(slotStart, slotEnd));
