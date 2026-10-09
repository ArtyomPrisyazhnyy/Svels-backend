import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ParseUuidV7Pipe } from '../../common/pipes/parse-uuid-v7.pipe';
import { ThrottleLimits } from '../../common/utils/throttle-limits.util';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { TelegramWebAppAuthDto } from './dto/telegram-webapp-auth.dto';
import { TelegramWebAppService } from './telegram-webapp.service';

@Controller('restaurants/:restaurantId/auth')
export class TelegramWebAppController {
  constructor(private readonly telegramWebAppService: TelegramWebAppService) {}

  @Post('telegram')
  @HttpCode(200)
  @Throttle(ThrottleLimits.otpVerify)
  login(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: TelegramWebAppAuthDto,
  ): Promise<AuthResponseDto> {
    return this.telegramWebAppService.login(restaurantId, dto.initData);
  }
}
