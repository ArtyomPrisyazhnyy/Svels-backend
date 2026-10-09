import {
  Body,
  Controller,
  GoneException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { ThrottleLimits } from '../common/utils/throttle-limits.util';
import { AuthService } from '../auth/auth.service';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import {
  GuestOtpRegisterDto,
  GuestOtpSendDto,
  GuestOtpVerifyDto,
} from '../otp/dto/guest-otp.dto';
import type {
  GuestOtpSendResponseDto,
  GuestOtpVerifyResponseDto,
} from '../otp/dto/guest-otp-response.dto';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants/:restaurantId/auth')
export class RestaurantGuestAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  @Post('otp/send')
  @Throttle(ThrottleLimits.otpSend)
  async sendOtp(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: GuestOtpSendDto,
    @Req() request: FastifyRequest,
  ): Promise<GuestOtpSendResponseDto> {
    await this.restaurantsService.ensureApproved(restaurantId);
    return this.authService.sendGuestOtp(restaurantId, dto, request.ip);
  }

  @Post('otp/resend')
  @Throttle(ThrottleLimits.otpSend)
  async resendOtp(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: GuestOtpSendDto,
    @Req() request: FastifyRequest,
  ): Promise<GuestOtpSendResponseDto> {
    await this.restaurantsService.ensureApproved(restaurantId);
    return this.authService.resendGuestOtp(restaurantId, dto, request.ip);
  }

  @Post('otp/verify')
  @Throttle(ThrottleLimits.otpVerify)
  async verifyOtp(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: GuestOtpVerifyDto,
  ): Promise<GuestOtpVerifyResponseDto> {
    await this.restaurantsService.ensureApproved(restaurantId);
    return this.authService.verifyGuestOtp(restaurantId, dto);
  }

  @Post('otp/register')
  @Throttle(ThrottleLimits.otpRegister)
  async registerWithOtp(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Body() dto: GuestOtpRegisterDto,
  ): Promise<AuthResponseDto> {
    await this.restaurantsService.ensureApproved(restaurantId);
    return this.authService.registerGuestWithOtp(restaurantId, dto);
  }

  /** Устарело: вход гостя только через OTP. */
  @Post('login')
  @Throttle(ThrottleLimits.authLogin)
  login(): never {
    throw new GoneException('Используйте /auth/otp/send и /auth/otp/verify');
  }

  /** Устарело: регистрация гостя только через OTP. */
  @Post('register')
  @Throttle(ThrottleLimits.authRegister)
  register(): never {
    throw new GoneException(
      'Используйте /auth/otp/send, /auth/otp/verify и /auth/otp/register',
    );
  }
}
