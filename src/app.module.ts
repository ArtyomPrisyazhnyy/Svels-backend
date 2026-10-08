import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import appConfig from './config/app.config';
import { validateEnv } from './config/env.validation';
import { isDevOrTestNodeEnv } from './config/is-dev-or-test-env';
import databaseConfig from './config/database.config';
import googleConfig from './config/google.config';
import jwtConfig from './config/jwt.config';
import bepaidConfig from './config/bepaid.config';
import nextSiteConfig from './config/next-site.config';
import leadsConfig from './config/leads.config';
import otpConfig from './config/otp.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import { AppCacheModule } from './cache/cache.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OtpModule } from './otp/otp.module';
import { UsersModule } from './users/users.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MenuModule } from './menu/menu.module';
import { MediaModule } from './media/media.module';
import { StorageModule } from './storage/storage.module';
import { SchedulesModule } from './schedules/schedules.module';
import { FloorPlansModule } from './floor-plans/floor-plans.module';
import { BookingsModule } from './bookings/bookings.module';
import { PreOrdersModule } from './pre-orders/pre-orders.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SocialLinksModule } from './social-links/social-links.module';
import { OrderSettingsModule } from './order-settings/order-settings.module';
import { BookingSettingsModule } from './booking-settings/booking-settings.module';
import { RestaurantStylingModule } from './restaurant-styling/restaurant-styling.module';
import { PromoBannersModule } from './promo-banners/promo-banners.module';
import { LoyaltySettingsModule } from './loyalty-settings/loyalty-settings.module';
import { PaymentSettingsModule } from './payment-settings/payment-settings.module';
import { PaymentsModule } from './payments/payments.module';
import { FavoritesModule } from './favorites/favorites.module';
import { LeadsModule } from './leads/leads.module';
import { NextRevalidationModule } from './next-revalidation/next-revalidation.module';
import { DevModule } from './dev/dev.module';
import { TelegramBotModule } from './telegram-bot/telegram-bot.module';
import { HealthModule } from './health/health.module';

const includeDevModule = isDevOrTestNodeEnv(process.env.NODE_ENV);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        storageConfig,
        jwtConfig,
        googleConfig,
        nextSiteConfig,
        otpConfig,
        leadsConfig,
        bepaidConfig,
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    HealthModule,
    AppCacheModule,
    StorageModule,
    MediaModule.forRoot({
      registerProcessor: process.env.IMAGE_PROCESSOR_IN_API === 'true',
    }),
    OtpModule,
    NextRevalidationModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    MenuModule,
    SchedulesModule,
    FloorPlansModule,
    BookingsModule,
    PreOrdersModule,
    AnalyticsModule,
    NotificationsModule,
    SocialLinksModule,
    OrderSettingsModule,
    BookingSettingsModule,
    RestaurantStylingModule,
    PromoBannersModule,
    LoyaltySettingsModule,
    PaymentSettingsModule,
    PaymentsModule,
    FavoritesModule,
    LeadsModule,
    ...(includeDevModule ? [DevModule] : []),
    TelegramBotModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
