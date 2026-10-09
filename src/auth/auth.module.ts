import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { OtpModule } from '../otp/otp.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleTokenService } from './google-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordSetToken } from './entities/password-set-token.entity';
import { PasswordSetService } from './password-set.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PasswordSetToken]),
    UsersModule,
    OtpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: 60 * 60 * 24 * 7,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleTokenService, JwtStrategy, PasswordSetService],
  exports: [AuthService, PasswordSetService],
})
export class AuthModule {}
