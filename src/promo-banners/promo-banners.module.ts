import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { PromoBanner } from './entities/promo-banner.entity';
import { PromoBannersController } from './promo-banners.controller';
import { PromoBannersService } from './promo-banners.service';

@Module({
  imports: [TypeOrmModule.forFeature([PromoBanner])],
  controllers: [PromoBannersController],
  providers: [PromoBannersService, RestaurantAccessGuard],
  exports: [PromoBannersService],
})
export class PromoBannersModule {}
