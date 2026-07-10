import { IsString, Matches, MinLength } from 'class-validator';

const PHONE_PATTERN = /^(\+?375|80)?[\d\s()-]{9,18}$/;

export class GuestRegisterDto {
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Некорректный номер телефона' })
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;
}

export class GuestLoginDto {
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Некорректный номер телефона' })
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;
}
