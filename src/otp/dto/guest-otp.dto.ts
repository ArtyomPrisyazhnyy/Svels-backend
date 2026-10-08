import { IsString, Matches, MinLength } from 'class-validator';

const PHONE_PATTERN = /^(\+?375|\+?7|8)?[\d\s()-]{9,18}$/;

export class GuestOtpSendDto {
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Некорректный номер телефона' })
  phone: string;
}

export class GuestOtpVerifyDto {
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Некорректный номер телефона' })
  phone: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'Некорректный код' })
  code: string;
}

export class GuestOtpRegisterDto {
  @IsString()
  @MinLength(10)
  registrationToken: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;
}
