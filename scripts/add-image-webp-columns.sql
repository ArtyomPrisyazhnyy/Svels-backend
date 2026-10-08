-- Для production (synchronize=false). В development TypeORM добавит колонки сам.
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS "imageWebpUrl" varchar NULL;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS "galleryWebpUrls" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS "logoWebpUrl" varchar NULL;
