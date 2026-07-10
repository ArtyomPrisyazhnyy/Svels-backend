import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RESTAURANTS_SERVICE } from '../common/constants/injection-tokens';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantRegistrationRequest } from './entities/restaurant-registration-request.entity';
import { RestaurantGuestAuthController } from './restaurant-guest-auth.controller';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, RestaurantRegistrationRequest]),
    AuthModule,
  ],
  controllers: [RestaurantsController, RestaurantGuestAuthController],
  providers: [
    RestaurantsService,
    RestaurantAccessGuard,
    { provide: RESTAURANTS_SERVICE, useExisting: RestaurantsService },
  ],
  exports: [RESTAURANTS_SERVICE],
})
export class RestaurantsModule {}
