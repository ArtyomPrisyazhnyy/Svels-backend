import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { TelegramLinkService } from './telegram-link.service';

@Controller('restaurants/:restaurantId/telegram')
export class TelegramRestaurantController {
  constructor(private readonly linkService: TelegramLinkService) {}

  @Post('link-code')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_RESTAURANT)
  createLinkCode(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.linkService.createLinkCode(restaurantId);
  }

  @Get('chats')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_RESTAURANT)
  listChats(@Param('restaurantId', ParseUuidV7Pipe) restaurantId: string) {
    return this.linkService.listChats(restaurantId);
  }

  @Delete('chats/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_RESTAURANT)
  async unlinkChat(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('id', ParseUuidV7Pipe) chatId: string,
  ): Promise<void> {
    await this.linkService.unlinkChat(restaurantId, chatId);
  }
}
