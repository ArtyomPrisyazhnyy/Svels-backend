-- Per-restaurant bePaid settings. Dev uses TypeORM synchronize.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS restaurant_payment_settings (
  "restaurantId" uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  "shopId" varchar(64) NULL UNIQUE,
  "secretKeyEncrypted" text NULL,
  "testMode" boolean NOT NULL DEFAULT true,
  "checkoutTransactionType" varchar(32) NOT NULL DEFAULT 'authorization',
  "autoCapture" boolean NOT NULL DEFAULT false,
  currency varchar(3) NOT NULL DEFAULT 'BYN',
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);
