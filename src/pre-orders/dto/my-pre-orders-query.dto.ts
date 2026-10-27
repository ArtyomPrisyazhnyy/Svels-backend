import { IsOptional } from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';

export class MyPreOrdersQueryDto {
  @IsOptional()
  @IsUuidV7()
  restaurantId?: string;
}
