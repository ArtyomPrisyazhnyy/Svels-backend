import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { isUuid } from '../common/utils/uuid.util';
import { MergeFavoritesDto } from './dto/favorites.dto';
import { FavoritesService } from './favorites.service';

@Controller('restaurants/:restaurantId/favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const guestId = this.parseGuestId(guestIdHeader);
    const owner = this.favoritesService.resolveOwner(user, guestId);
    return this.favoritesService.list(restaurantId, owner);
  }

  /** Union гостевого и аккаунтного избранного; guest-строки удаляются. */
  @Post('merge')
  @UseGuards(JwtAuthGuard)
  merge(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MergeFavoritesDto,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const guestId = dto.guestId || this.parseGuestId(guestIdHeader);
    if (!guestId) {
      throw new BadRequestException('guestId обязателен');
    }
    return this.favoritesService.mergeGuestIntoUser(restaurantId, user.id, guestId);
  }

  @Post(':menuItemId')
  @UseGuards(OptionalJwtAuthGuard)
  add(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('menuItemId', ParseUuidV7Pipe) menuItemId: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const guestId = this.parseGuestId(guestIdHeader);
    const owner = this.favoritesService.resolveOwner(user, guestId);
    return this.favoritesService.add(restaurantId, menuItemId, owner);
  }

  @Delete(':menuItemId')
  @UseGuards(OptionalJwtAuthGuard)
  remove(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('menuItemId', ParseUuidV7Pipe) menuItemId: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const guestId = this.parseGuestId(guestIdHeader);
    const owner = this.favoritesService.resolveOwner(user, guestId);
    return this.favoritesService.remove(restaurantId, menuItemId, owner);
  }

  private parseGuestId(header?: string): string | undefined {
    if (!header?.trim()) {
      return undefined;
    }
    const value = header.trim();
    if (!isUuid(value)) {
      throw new BadRequestException('Некорректный X-Guest-Id');
    }
    return value;
  }
}
