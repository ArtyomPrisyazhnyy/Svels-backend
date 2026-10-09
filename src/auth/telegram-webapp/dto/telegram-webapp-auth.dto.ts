import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TelegramWebAppAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  initData: string;
}
