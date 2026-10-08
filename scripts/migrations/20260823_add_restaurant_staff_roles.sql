-- Migration: staff roles on users.role enum
--
-- TypeORM synchronize не всегда добавляет значения в уже существующий Postgres enum.
-- На production / если бэкенд падает на enum:
--   psql "$DATABASE_URL" -f scripts/migrations/20260823_add_restaurant_staff_roles.sql

DO $$
DECLARE
  enum_name text;
  new_label text;
BEGIN
  SELECT t.typname
  INTO enum_name
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE e.enumlabel = 'restaurant_admin'
  LIMIT 1;

  IF enum_name IS NULL THEN
    RAISE NOTICE 'users role enum not found, skip';
    RETURN;
  END IF;

  FOREACH new_label IN ARRAY ARRAY[
    'restaurant_manager',
    'restaurant_hall',
    'restaurant_production'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = new_label
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = enum_name)
    ) THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_name, new_label);
    END IF;
  END LOOP;
END$$;
