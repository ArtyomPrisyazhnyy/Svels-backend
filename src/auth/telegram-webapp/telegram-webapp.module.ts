import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import telegramBotConfig from '../../telegram-bot/telegram-bot.config';
import { RestaurantsModule } from '../../restaurants/restaurants.module';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../auth.module';
import { TelegramGuestLink } from './entities/telegram-guest-link.entity';
import { TelegramWebAppController } from './telegram-webapp.controller';
import { TelegramWebAppService } from './telegram-webapp.service';

@Module({
  imports: [
    ConfigModule.forFeature(telegramBotConfig),
    TypeOrmModule.forFeature([TelegramGuestLink]),
    AuthModule,
    UsersModule,
    RestaurantsModule,
  ],
  controllers: [TelegramWebAppController],
  providers: [TelegramWebAppService],
})
export class TelegramWebAppModule {}
