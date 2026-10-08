import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ThrottleLimits } from '../common/utils/throttle-limits.util';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(ThrottleLimits.authRegister)
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle(ThrottleLimits.authLogin)
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('google')
  @Throttle(ThrottleLimits.authGoogle)
  loginWithGoogle(@Body() dto: GoogleAuthDto): Promise<AuthResponseDto> {
    return this.authService.loginWithGoogle(dto);
  }
}
