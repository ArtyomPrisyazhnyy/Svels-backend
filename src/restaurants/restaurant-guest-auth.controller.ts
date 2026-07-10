import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { AuthService } from '../auth/auth.service';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { GuestLoginDto, GuestRegisterDto } from '../auth/dto/guest-auth.dto';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants/:restaurantId/auth')
export class RestaurantGuestAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: GuestRegisterDto,
  ): Promise<AuthResponseDto> {
    await this.restaurantsService.ensureApproved(restaurantId);
    return this.authService.registerGuest(restaurantId, dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: GuestLoginDto,
  ): Promise<AuthResponseDto> {
    await this.restaurantsService.ensureApproved(restaurantId);
    return this.authService.loginGuest(restaurantId, dto);
  }
}
