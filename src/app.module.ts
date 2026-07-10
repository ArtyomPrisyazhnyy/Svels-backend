import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import googleConfig from './config/google.config';
import jwtConfig from './config/jwt.config';
import nextSiteConfig from './config/next-site.config';
import redisConfig from './config/redis.config';
import { AppCacheModule } from './cache/cache.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MenuModule } from './menu/menu.module';
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
import { NextRevalidationModule } from './next-revalidation/next-revalidation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, googleConfig, nextSiteConfig],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AppCacheModule,
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
