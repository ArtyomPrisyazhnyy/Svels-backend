import { Module } from '@nestjs/common';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [RestaurantsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
