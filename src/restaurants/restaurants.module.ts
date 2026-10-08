import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RESTAURANTS_SERVICE } from '../common/constants/injection-tokens';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantLocation } from './entities/restaurant-location.entity';
import { RestaurantRegistrationRequest } from './entities/restaurant-registration-request.entity';
import { RestaurantGuestAuthController } from './restaurant-guest-auth.controller';
import { RestaurantLocationsController } from './restaurant-locations.controller';
import { RestaurantLocationsService } from './restaurant-locations.service';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Restaurant,
      RestaurantLocation,
      RestaurantRegistrationRequest,
    ]),
    AuthModule,
  ],
  controllers: [
    RestaurantsController,
    RestaurantLocationsController,
    RestaurantGuestAuthController,
  ],
  providers: [
    RestaurantsService,
    RestaurantLocationsService,
    RestaurantAccessGuard,
    { provide: RESTAURANTS_SERVICE, useExisting: RestaurantsService },
  ],
  exports: [RESTAURANTS_SERVICE, RestaurantLocationsService],
})
export class RestaurantsModule {}
