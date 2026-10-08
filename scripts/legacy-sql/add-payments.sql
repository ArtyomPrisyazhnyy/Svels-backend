-- Payments (bePaid). Dev uses TypeORM synchronize.
-- Safe to run multiple times.

DO $$ BEGIN
  CREATE TYPE payments_status_enum AS ENUM (
    'pending',
    'authorized',
    'captured',
    'voided',
    'failed',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  "restaurantId" uuid NOT NULL,
  "preOrderId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  provider varchar(32) NOT NULL DEFAULT 'bepaid',
  status payments_status_enum NOT NULL DEFAULT 'pending',
  amount numeric(10, 2) NOT NULL,
  "amountMinor" int NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'BYN',
  "trackingId" varchar(255) NOT NULL,
  "checkoutToken" varchar(255) NULL,
  "redirectUrl" varchar(2048) NULL,
  "bepaidUid" varchar(128) NULL,
  "parentUid" varchar(128) NULL,
  test boolean NOT NULL DEFAULT true,
  "transactionType" varchar(32) NULL,
  "lastMessage" text NULL,
  "lastPayload" jsonb NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_pre_order ON payments ("preOrderId");
CREATE INDEX IF NOT EXISTS idx_payments_tracking ON payments ("trackingId");
CREATE INDEX IF NOT EXISTS idx_payments_checkout_token ON payments ("checkoutToken");
