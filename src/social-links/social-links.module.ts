import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RestaurantSocialLink } from './entities/restaurant-social-link.entity';
import { SocialLinksController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantSocialLink])],
  controllers: [SocialLinksController],
  providers: [SocialLinksService, RestaurantAccessGuard],
  exports: [SocialLinksService],
})
export class SocialLinksModule {}
