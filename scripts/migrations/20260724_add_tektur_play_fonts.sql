-- Migration: add Tektur and Play to restaurant_styling.fontFamily enum
--
-- На dev-окружении (synchronize: true) TypeORM может не добавить значения
-- в уже существующий Postgres enum — применять вручную при необходимости:
--   psql "$DATABASE_URL" -f scripts/migrations/20260724_add_tektur_play_fonts.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'tektur'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'restaurant_styling_fontfamily_enum'
      )
  ) THEN
    ALTER TYPE restaurant_styling_fontfamily_enum ADD VALUE 'tektur';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'play'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'restaurant_styling_fontfamily_enum'
      )
  ) THEN
    ALTER TYPE restaurant_styling_fontfamily_enum ADD VALUE 'play';
  END IF;
END$$;
