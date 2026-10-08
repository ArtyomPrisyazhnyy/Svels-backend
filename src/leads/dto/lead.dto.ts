import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'Введите корректный номер телефона',
  })
  phone: string;

  @IsBoolean()
  contactTelegram: boolean;

  @IsBoolean()
  contactWhatsapp: boolean;

  @IsBoolean()
  contactViber: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class LeadResponseDto {
  id: string;
}
