import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { PreOrdersModule } from '../pre-orders/pre-orders.module';
import { RestaurantLocation } from '../restaurants/entities/restaurant-location.entity';
import { TelegramWebAppModule } from '../auth/telegram-webapp/telegram-webapp.module';
import { RestaurantTelegramChat } from './entities/restaurant-telegram-chat.entity';
import { TelegramLinkCode } from './entities/telegram-link-code.entity';
import { TelegramOrderMessage } from './entities/telegram-order-message.entity';
import telegramBotConfig from './telegram-bot.config';
import { TelegramApiClient } from './telegram-api.client';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramOrderEventsListener } from './telegram-order-events.listener';
import { TelegramOrderNotificationService } from './telegram-order-notification.service';
import { TelegramRestaurantController } from './telegram-restaurant.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramWebhookService } from './telegram-webhook.service';

@Module({
  imports: [
    ConfigModule.forFeature(telegramBotConfig),
    TypeOrmModule.forFeature([
      RestaurantTelegramChat,
      TelegramLinkCode,
      TelegramOrderMessage,
      RestaurantLocation,
    ]),
    PreOrdersModule,
    TelegramWebAppModule,
  ],
  controllers: [TelegramRestaurantController, TelegramWebhookController],
  providers: [
    TelegramApiClient,
    TelegramLinkService,
    TelegramOrderNotificationService,
    TelegramOrderEventsListener,
    TelegramWebhookService,
    RestaurantAccessGuard,
  ],
})
export class TelegramBotModule {}
