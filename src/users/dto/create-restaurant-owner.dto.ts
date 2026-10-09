import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRestaurantOwnerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
