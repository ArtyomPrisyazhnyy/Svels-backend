-- Promo banners for restaurant public pages (dev uses TypeORM synchronize).
-- Safe to run multiple times.

DO $$ BEGIN
  CREATE TYPE restaurant_promo_banners_type_enum AS ENUM ('modal', 'strip');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE restaurant_promo_banners_displayfrequency_enum AS ENUM ('once', 'every_visit');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE restaurant_promo_banners_aspectratio_enum AS ENUM ('4_1', '16_9');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS restaurant_promo_banners (
  id uuid PRIMARY KEY,
  "restaurantId" uuid NOT NULL,
  type restaurant_promo_banners_type_enum NOT NULL,
  title varchar(200) NULL,
  "imageUrl" varchar(2048) NOT NULL,
  "imageWebpUrl" varchar(2048) NULL,
  "linkUrl" varchar(2048) NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "sortOrder" int NOT NULL DEFAULT 0,
  "displayFrequency" restaurant_promo_banners_displayfrequency_enum NOT NULL DEFAULT 'every_visit',
  "aspectRatio" restaurant_promo_banners_aspectratio_enum NOT NULL DEFAULT '4_1',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_promo_banners_restaurant
  ON restaurant_promo_banners ("restaurantId");
