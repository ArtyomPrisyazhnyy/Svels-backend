import { IsString, MinLength } from 'class-validator';

export class ResolveDomainQueryDto {
  @IsString()
  @MinLength(3)
  host: string;
}

export class ResolveDomainResponseDto {
  id: string;
  name: string;
  customDomain: string;
}
