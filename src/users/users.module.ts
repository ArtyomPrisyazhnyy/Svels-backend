import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { USERS_SERVICE } from '../common/constants/injection-tokens';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RestaurantApprovedListener } from './listeners/restaurant-approved.listener';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [
    UsersService,
    RestaurantApprovedListener,
    { provide: USERS_SERVICE, useExisting: UsersService },
  ],
  exports: [USERS_SERVICE],
})
export class UsersModule {}
