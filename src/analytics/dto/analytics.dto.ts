import { IsDateString, IsOptional } from 'class-validator';
import { IsUuidV7 } from '../../common/decorators/is-uuid-v7.decorator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsUuidV7()
  restaurantId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class TrackVisitDto {
  @IsUuidV7()
  restaurantId: string;
}