import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuModule } from '../menu/menu.module';
import { Favorite } from './entities/favorite.entity';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { UserDeletedFavoritesListener } from './listeners/user-deleted.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite]), MenuModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, UserDeletedFavoritesListener],
  exports: [FavoritesService],
})
export class FavoritesModule {}
