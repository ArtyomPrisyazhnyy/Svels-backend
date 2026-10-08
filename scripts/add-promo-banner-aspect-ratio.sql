-- Aspect ratio for strip promo banners (4:1 default, 16:9 for TV-style).
-- Safe to run multiple times.

DO $$ BEGIN
  CREATE TYPE restaurant_promo_banners_aspectratio_enum AS ENUM ('4_1', '16_9');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE restaurant_promo_banners
  ADD COLUMN IF NOT EXISTS "aspectRatio" restaurant_promo_banners_aspectratio_enum
  NOT NULL DEFAULT '4_1';
