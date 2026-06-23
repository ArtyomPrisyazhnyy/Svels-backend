import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RESTAURANTS_SERVICE } from '../common/constants/injection-tokens';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantRegistrationRequest } from './entities/restaurant-registration-request.entity';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Restaurant, RestaurantRegistrationRequest])],
  controllers: [RestaurantsController],
  providers: [
    RestaurantsService,
    { provide: RESTAURANTS_SERVICE, useExisting: RestaurantsService },
  ],
  exports: [RESTAURANTS_SERVICE],
})
export class RestaurantsModule {}
