import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CaddyAskQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(253)
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i, {
    message: 'Некорректный домен',
  })
  domain!: string;
}
