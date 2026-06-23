import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MENU_SERVICE } from '../common/constants/injection-tokens';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [TypeOrmModule.forFeature([MenuCategory, MenuItem])],
  controllers: [MenuController],
  providers: [
    MenuService,
    RestaurantAccessGuard,
    { provide: MENU_SERVICE, useExisting: MenuService },
  ],
  exports: [MENU_SERVICE],
})
export class MenuModule {}
