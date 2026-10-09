import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';

export class StaffChangeOrderStatusDto {
  @IsEnum(PreOrderStatus)
  status: PreOrderStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  cancelReason?: string;
}
