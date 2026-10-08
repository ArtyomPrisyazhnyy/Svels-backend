-- Restaurant loyalty / flame settings (dev uses TypeORM synchronize).
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS restaurant_loyalty_settings (
  "restaurantId" uuid PRIMARY KEY,
  "flameDisplayEnabled" boolean NOT NULL DEFAULT false,
  "flameRewardsEnabled" boolean NOT NULL DEFAULT false,
  "flameExpireDays" int NOT NULL DEFAULT 14,
  "flameLevels" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "otherPrograms" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);
