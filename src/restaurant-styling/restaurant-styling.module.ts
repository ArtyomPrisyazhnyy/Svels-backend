import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RestaurantStyling } from './entities/restaurant-styling.entity';
import { RestaurantStylingController } from './restaurant-styling.controller';
import { RestaurantStylingService } from './restaurant-styling.service';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantStyling])],
  controllers: [RestaurantStylingController],
  providers: [RestaurantStylingService, RestaurantAccessGuard],
  exports: [RestaurantStylingService],
})
export class RestaurantStylingModule {}
