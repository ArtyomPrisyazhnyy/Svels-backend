import { Module } from '@nestjs/common';
import { RestaurantsModule } from '../../restaurants/restaurants.module';
import { CorsOriginService } from './cors-origin.service';

@Module({
  imports: [RestaurantsModule],
  providers: [CorsOriginService],
  exports: [CorsOriginService],
})
export class CorsModule {}
