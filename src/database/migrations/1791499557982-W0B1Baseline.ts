import { MigrationInterface, QueryRunner } from 'typeorm';

export class W0B1Baseline1791499557982 implements MigrationInterface {
  name = 'W0B1Baseline1791499557982';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "visit_stats" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "userId" uuid, "visitDate" date NOT NULL, "pageViews" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_30fb09a1a2e3b1bdcc7dc583293" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_booking_settings_mode_enum" AS ENUM('specific_table', 'by_seats')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_booking_settings_depositscheme_enum" AS ENUM('no_deposit', 'global_deposit', 'per_zone', 'per_table')`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_booking_settings" ("restaurantId" uuid NOT NULL, "bookingEnabled" boolean NOT NULL DEFAULT false, "mode" "public"."restaurant_booking_settings_mode_enum" NOT NULL DEFAULT 'specific_table', "depositScheme" "public"."restaurant_booking_settings_depositscheme_enum" NOT NULL DEFAULT 'no_deposit', "depositAmount" numeric(10,2) NOT NULL DEFAULT '0', "bookingDurationMinutes" integer NOT NULL DEFAULT '120', "slotMinutes" integer NOT NULL DEFAULT '30', "maxGuests" integer NOT NULL DEFAULT '8', "advanceDays" integer NOT NULL DEFAULT '14', "autoConfirm" boolean NOT NULL DEFAULT false, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_510685465bcc5965991217666f9" PRIMARY KEY ("restaurantId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('pending', 'confirmed', 'cancelled', 'completed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "tableId" uuid, "userId" uuid NOT NULL, "bookingDate" date NOT NULL, "bookingTime" TIME NOT NULL, "slotStart" TIMESTAMP WITH TIME ZONE NOT NULL, "slotEnd" TIMESTAMP WITH TIME ZONE NOT NULL, "guestCount" integer NOT NULL, "depositAmount" numeric(10,2) NOT NULL DEFAULT '0', "version" integer NOT NULL DEFAULT '0', "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending', "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bookings_user" ON "bookings"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bookings_table" ON "bookings"  ("tableId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bookings_restaurant_date" ON "bookings"  ("restaurantId", "bookingDate") `,
    );
    await queryRunner.query(
      `CREATE TABLE "favorites" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "menuItemId" uuid NOT NULL, "userId" uuid, "guestId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_890818d27523748dd36a4d1bdc8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_favorites_guest_item" ON "favorites"  ("restaurantId", "guestId", "menuItemId") WHERE "guestId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_favorites_user_item" ON "favorites"  ("restaurantId", "userId", "menuItemId") WHERE "userId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "floor_plans" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "name" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "depositAmount" numeric(10,2) NOT NULL DEFAULT '0', "decorData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4243d68fe3bfa6a38a2cccd5e9f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_floor_plans_restaurant" ON "floor_plans"  ("restaurantId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tables_shape_enum" AS ENUM('rectangle', 'round', 'square', 'oval', 'polygon')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tables_objecttype_enum" AS ENUM('table', 'bar', 'billiard', 'cabana', 'room', 'lounger')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tables" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "floorPlanId" uuid NOT NULL, "label" character varying NOT NULL, "minCapacity" integer NOT NULL DEFAULT '1', "capacity" integer NOT NULL, "positionX" double precision, "positionY" double precision, "width" double precision NOT NULL DEFAULT '90', "height" double precision NOT NULL DEFAULT '90', "points" jsonb, "seats" jsonb, "cornerRadius" double precision NOT NULL DEFAULT '6', "rotation" double precision NOT NULL DEFAULT '0', "shape" "public"."tables_shape_enum" NOT NULL DEFAULT 'rectangle', "objectType" "public"."tables_objecttype_enum" NOT NULL DEFAULT 'table', "depositAmount" numeric(10,2) NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "visibleToGuests" boolean NOT NULL DEFAULT true, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7cf2aca7af9550742f855d4eb69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tables_restaurant" ON "tables"  ("restaurantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tables_floor_plan" ON "tables"  ("floorPlanId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "landing_leads" ("id" uuid NOT NULL, "name" character varying(120) NOT NULL, "phone" character varying(40) NOT NULL, "contactTelegram" boolean NOT NULL DEFAULT false, "contactWhatsapp" boolean NOT NULL DEFAULT false, "contactViber" boolean NOT NULL DEFAULT false, "note" character varying(2000), "source" character varying(120), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d98cccffd48803c03196041f1fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_loyalty_settings" ("restaurantId" uuid NOT NULL, "flameDisplayEnabled" boolean NOT NULL DEFAULT false, "flameRewardsEnabled" boolean NOT NULL DEFAULT false, "flameExpireDays" integer NOT NULL DEFAULT '14', "flameLevels" jsonb NOT NULL DEFAULT '[]', "otherPrograms" jsonb NOT NULL DEFAULT '[]', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d8bae7cf7df2ec5f854303100e" PRIMARY KEY ("restaurantId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "menu_categories" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "name" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_124ae987900336f983881cb04e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "menu_items" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "categoryId" uuid NOT NULL, "name" character varying NOT NULL, "variantLabel" character varying(80), "description" text, "ingredients" text, "nutrition" jsonb, "price" numeric(10,2) NOT NULL, "oldPrice" numeric(10,2), "isAvailable" boolean NOT NULL DEFAULT true, "imageUrl" character varying NOT NULL, "imageWebpUrl" character varying, "galleryUrls" jsonb NOT NULL DEFAULT '[]', "galleryWebpUrls" jsonb NOT NULL DEFAULT '[]', "modifierGroups" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57e6188f929e5dc6919168620c8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_order_settings" ("restaurantId" uuid NOT NULL, "fulfillmentDelivery" boolean NOT NULL DEFAULT false, "fulfillmentTakeaway" boolean NOT NULL DEFAULT true, "fulfillmentDineIn" boolean NOT NULL DEFAULT true, "paymentCash" boolean NOT NULL DEFAULT true, "paymentCardOnSite" boolean NOT NULL DEFAULT true, "paymentOnline" boolean NOT NULL DEFAULT true, "deliveryForSomeoneElse" boolean NOT NULL DEFAULT false, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_88f82c61fc5e0342029c0516a3e" PRIMARY KEY ("restaurantId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_payment_settings" ("restaurantId" uuid NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "shopId" character varying(64), "secretKeyEncrypted" text, "testMode" boolean NOT NULL DEFAULT true, "checkoutTransactionType" character varying(32) NOT NULL DEFAULT 'authorization', "autoCapture" boolean NOT NULL DEFAULT false, "currency" character varying(3) NOT NULL DEFAULT 'BYN', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ad4b8c2ab4245f4be5c5428ba9f" UNIQUE ("shopId"), CONSTRAINT "PK_2b3f2df466ee590b1424dd91d27" PRIMARY KEY ("restaurantId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'authorized', 'captured', 'voided', 'failed', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "preOrderId" uuid NOT NULL, "userId" uuid NOT NULL, "provider" character varying(32) NOT NULL DEFAULT 'bepaid', "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "amount" numeric(10,2) NOT NULL, "amountMinor" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'BYN', "trackingId" character varying(255) NOT NULL, "checkoutToken" character varying(255), "redirectUrl" character varying(2048), "bepaidUid" character varying(128), "parentUid" character varying(128), "test" boolean NOT NULL DEFAULT true, "transactionType" character varying(32), "lastMessage" text, "lastPayload" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "pre_order_items" ("id" uuid NOT NULL, "preOrderId" uuid NOT NULL, "menuItemId" uuid NOT NULL, "name" character varying NOT NULL, "quantity" integer NOT NULL, "unitPrice" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_349538836a8c8c622574bd51939" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pre_orders_status_enum" AS ENUM('pending', 'confirmed', 'paid', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pre_orders_paymentmethod_enum" AS ENUM('cash', 'card', 'online')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pre_orders" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "userId" uuid NOT NULL, "bookingId" uuid, "status" "public"."pre_orders_status_enum" NOT NULL DEFAULT 'pending', "paymentMethod" "public"."pre_orders_paymentmethod_enum" NOT NULL, "totalAmount" numeric(10,2) NOT NULL, "comment" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a93a078ae8f7b29b0c0c97ac8de" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_promo_banners_type_enum" AS ENUM('modal', 'strip')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_promo_banners_displayfrequency_enum" AS ENUM('once', 'every_visit')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_promo_banners_aspectratio_enum" AS ENUM('4_1', '16_9')`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_promo_banners" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "type" "public"."restaurant_promo_banners_type_enum" NOT NULL, "title" character varying(200), "imageUrl" character varying(2048) NOT NULL, "imageWebpUrl" character varying(2048), "linkUrl" character varying(2048), "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "displayFrequency" "public"."restaurant_promo_banners_displayfrequency_enum" NOT NULL DEFAULT 'every_visit', "aspectRatio" "public"."restaurant_promo_banners_aspectratio_enum" NOT NULL DEFAULT '4_1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9b4feeef237ca8745f95e67bd1e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_fontfamily_enum" AS ENUM('system', 'inter', 'georgia', 'montserrat', 'playfair', 'gothic60', 'marmelad', 'comfortaa', 'comicRelief', 'roboto', 'tektur', 'play')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_colortheme_enum" AS ENUM('classic', 'ocean', 'forest', 'warm', 'berry', 'lavender', 'midnight', 'ember', 'obsidian', 'moss', 'wine', 'sand', 'citrus', 'graphite', 'monochrome', 'monochromeDark', 'neon')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_currencydisplay_enum" AS ENUM('byn_glyph', 'byn', 'r', 'rub')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_buttonshape_enum" AS ENUM('rounded', 'pill')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_buttonvariant_enum" AS ENUM('filled', 'outline', 'soft')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_switcherstyle_enum" AS ENUM('pill', 'segmented', 'tabs')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_cardstyle_enum" AS ENUM('classic', 'elevated', 'overlay', 'minimal', 'glass', 'magazine')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_magazinecardlayout_enum" AS ENUM('content_left', 'media_left')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_headerstyle_enum" AS ENUM('glass', 'solid', 'bordered')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_footerlayout_enum" AS ENUM('columns', 'centered', 'minimal')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_styling_footeraccent_enum" AS ENUM('flat', 'tinted', 'top-border')`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_styling" ("restaurantId" uuid NOT NULL, "fontFamily" "public"."restaurant_styling_fontfamily_enum" NOT NULL DEFAULT 'system', "colorTheme" "public"."restaurant_styling_colortheme_enum" NOT NULL DEFAULT 'classic', "currencyDisplay" "public"."restaurant_styling_currencydisplay_enum" NOT NULL DEFAULT 'byn_glyph', "buttonShape" "public"."restaurant_styling_buttonshape_enum" NOT NULL DEFAULT 'rounded', "buttonVariant" "public"."restaurant_styling_buttonvariant_enum" NOT NULL DEFAULT 'filled', "switcherStyle" "public"."restaurant_styling_switcherstyle_enum" NOT NULL DEFAULT 'pill', "cardStyle" "public"."restaurant_styling_cardstyle_enum" NOT NULL DEFAULT 'classic', "magazineCardLayout" "public"."restaurant_styling_magazinecardlayout_enum" NOT NULL DEFAULT 'content_left', "menuCategoryNavEnabled" boolean NOT NULL DEFAULT false, "favoritesEnabled" boolean NOT NULL DEFAULT true, "headerStyle" "public"."restaurant_styling_headerstyle_enum" NOT NULL DEFAULT 'glass', "footerLayout" "public"."restaurant_styling_footerlayout_enum" NOT NULL DEFAULT 'columns', "footerAccent" "public"."restaurant_styling_footeraccent_enum" NOT NULL DEFAULT 'flat', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d5153533675df3148709c4dbbc8" PRIMARY KEY ("restaurantId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_locations" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "city" character varying(120) NOT NULL, "address" character varying(500) NOT NULL, "label" character varying(120), "lat" double precision NOT NULL, "lng" double precision NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_30c0150fe2a2feea256939cbe74" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_registration_requests_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_registration_requests" ("id" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "address" character varying NOT NULL, "unp" character varying(9) NOT NULL, "isChain" boolean NOT NULL DEFAULT false, "locations" jsonb NOT NULL, "applicantId" uuid NOT NULL, "status" "public"."restaurant_registration_requests_status_enum" NOT NULL DEFAULT 'pending', "rejectionReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0bf3ab5ab2f0f7f9462a54cfdb9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurants_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurants" ("id" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "address" character varying NOT NULL, "unp" character varying(9), "status" "public"."restaurants_status_enum" NOT NULL DEFAULT 'pending', "ownerId" uuid NOT NULL, "customDomain" character varying(253), "logoUrl" character varying, "logoWebpUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1560c6f10f076eefaa2b3c4e644" UNIQUE ("customDomain"), CONSTRAINT "PK_e2133a72eb1cc8f588f7b503e68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "work_schedules" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "dayOfWeek" smallint NOT NULL, "openTime" TIME NOT NULL, "closeTime" TIME NOT NULL, "isOpen" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f5251879700e5ca0d2e353fa34f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."restaurant_social_links_platform_enum" AS ENUM('telegram', 'instagram', 'vk', 'facebook', 'youtube', 'tiktok', 'twitter', 'whatsapp', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "restaurant_social_links" ("id" uuid NOT NULL, "restaurantId" uuid NOT NULL, "url" character varying(2048) NOT NULL, "label" character varying(120), "platform" "public"."restaurant_social_links_platform_enum" NOT NULL DEFAULT 'other', "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4aecd963a9befef4af1fbeb8488" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'restaurant_admin', 'restaurant_manager', 'restaurant_hall', 'restaurant_production', 'super_admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_authprovider_enum" AS ENUM('local', 'google')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL, "email" character varying NOT NULL, "phone" character varying, "passwordHash" character varying, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "authProvider" "public"."users_authprovider_enum" NOT NULL DEFAULT 'local', "googleId" character varying, "restaurantId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2e2f85a3b239d58e56ff142032" ON "users"  ("phone", "restaurantId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_830be030f0a8a504a6c2eb12de" ON "users"  ("email", "restaurantId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_830be030f0a8a504a6c2eb12de"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2e2f85a3b239d58e56ff142032"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_authprovider_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "restaurant_social_links"`);
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_social_links_platform_enum"`,
    );
    await queryRunner.query(`DROP TABLE "work_schedules"`);
    await queryRunner.query(`DROP TABLE "restaurants"`);
    await queryRunner.query(`DROP TYPE "public"."restaurants_status_enum"`);
    await queryRunner.query(`DROP TABLE "restaurant_registration_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_registration_requests_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "restaurant_locations"`);
    await queryRunner.query(`DROP TABLE "restaurant_styling"`);
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_footeraccent_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_footerlayout_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_headerstyle_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_magazinecardlayout_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_cardstyle_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_switcherstyle_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_buttonvariant_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_buttonshape_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_currencydisplay_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_colortheme_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_styling_fontfamily_enum"`,
    );
    await queryRunner.query(`DROP TABLE "restaurant_promo_banners"`);
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_promo_banners_aspectratio_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_promo_banners_displayfrequency_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_promo_banners_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "pre_orders"`);
    await queryRunner.query(
      `DROP TYPE "public"."pre_orders_paymentmethod_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."pre_orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "pre_order_items"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TABLE "restaurant_payment_settings"`);
    await queryRunner.query(`DROP TABLE "restaurant_order_settings"`);
    await queryRunner.query(`DROP TABLE "menu_items"`);
    await queryRunner.query(`DROP TABLE "menu_categories"`);
    await queryRunner.query(`DROP TABLE "restaurant_loyalty_settings"`);
    await queryRunner.query(`DROP TABLE "landing_leads"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tables_floor_plan"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tables_restaurant"`);
    await queryRunner.query(`DROP TABLE "tables"`);
    await queryRunner.query(`DROP TYPE "public"."tables_objecttype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tables_shape_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_floor_plans_restaurant"`);
    await queryRunner.query(`DROP TABLE "floor_plans"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_favorites_user_item"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_favorites_guest_item"`);
    await queryRunner.query(`DROP TABLE "favorites"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_bookings_restaurant_date"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_bookings_table"`);
    await queryRunner.query(`DROP INDEX "public"."idx_bookings_user"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "restaurant_booking_settings"`);
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_booking_settings_depositscheme_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."restaurant_booking_settings_mode_enum"`,
    );
    await queryRunner.query(`DROP TABLE "visit_stats"`);
  }
}
