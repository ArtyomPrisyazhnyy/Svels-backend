import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import {
  CreateGuestAddressDto,
  GuestAddressDto,
  UpdateGuestAddressDto,
} from './dto/guest-address.dto';
import { GuestAddressesService } from './guest-addresses.service';
import { assertGuestRestaurantAccess } from './utils/guest-address-error.util';

@Controller('restaurants/:restaurantId/me/addresses')
@UseGuards(JwtAuthGuard)
export class GuestAddressesController {
  constructor(private readonly guestAddressesService: GuestAddressesService) {}

  @Get()
  list(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GuestAddressDto[]> {
    assertGuestRestaurantAccess(user.role, user.restaurantId, restaurantId);
    return this.guestAddressesService.list(restaurantId, user.id);
  }

  @Post()
  async create(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGuestAddressDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<GuestAddressDto> {
    assertGuestRestaurantAccess(user.role, user.restaurantId, restaurantId);
    const result = await this.guestAddressesService.create(
      restaurantId,
      user.id,
      dto,
    );
    reply.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.dto;
  }

  @Post(':id/default')
  setDefault(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('id', ParseUuidV7Pipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GuestAddressDto> {
    assertGuestRestaurantAccess(user.role, user.restaurantId, restaurantId);
    return this.guestAddressesService.setDefault(restaurantId, user.id, id);
  }

  @Patch(':id')
  update(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('id', ParseUuidV7Pipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateGuestAddressDto,
  ): Promise<GuestAddressDto> {
    assertGuestRestaurantAccess(user.role, user.restaurantId, restaurantId);
    return this.guestAddressesService.update(restaurantId, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Param('id', ParseUuidV7Pipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    assertGuestRestaurantAccess(user.role, user.restaurantId, restaurantId);
    await this.guestAddressesService.remove(restaurantId, user.id, id);
  }
}
