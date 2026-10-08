import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MENU_SERVICE } from '../common/constants/injection-tokens';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import type { MenuService } from '../menu/menu.service';
import type { FavoritesListResponseDto } from './dto/favorites.dto';
import { Favorite } from './entities/favorite.entity';

type FavoriteOwner =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; guestId: string };

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @Inject(MENU_SERVICE)
    private readonly menuService: MenuService,
  ) {}

  resolveOwner(
    user: AuthenticatedUser | null | undefined,
    guestId: string | undefined,
  ): FavoriteOwner {
    if (user?.id) {
      return { kind: 'user', userId: user.id };
    }
    if (guestId) {
      return { kind: 'guest', guestId };
    }
    throw new UnauthorizedException(
      'Нужна авторизация или заголовок X-Guest-Id',
    );
  }

  async list(
    restaurantId: string,
    owner: FavoriteOwner,
  ): Promise<FavoritesListResponseDto> {
    const rows = await this.favoriteRepository.find({
      where:
        owner.kind === 'user'
          ? { restaurantId, userId: owner.userId }
          : { restaurantId, guestId: owner.guestId },
      select: { menuItemId: true },
      order: { createdAt: 'DESC' },
    });
    return { menuItemIds: rows.map((row) => row.menuItemId) };
  }

  async add(
    restaurantId: string,
    menuItemId: string,
    owner: FavoriteOwner,
  ): Promise<FavoritesListResponseDto> {
    await this.menuService.assertItemBelongsToRestaurant(restaurantId, menuItemId);

    const existing = await this.findOne(restaurantId, menuItemId, owner);
    if (!existing) {
      const favorite = this.favoriteRepository.create({
        restaurantId,
        menuItemId,
        userId: owner.kind === 'user' ? owner.userId : null,
        guestId: owner.kind === 'guest' ? owner.guestId : null,
      });
      try {
        await this.favoriteRepository.save(favorite);
      } catch {
        // Гонка уникального индекса — уже есть.
      }
    }

    return this.list(restaurantId, owner);
  }

  async remove(
    restaurantId: string,
    menuItemId: string,
    owner: FavoriteOwner,
  ): Promise<FavoritesListResponseDto> {
    await this.favoriteRepository.delete(
      owner.kind === 'user'
        ? { restaurantId, menuItemId, userId: owner.userId }
        : { restaurantId, menuItemId, guestId: owner.guestId },
    );
    return this.list(restaurantId, owner);
  }

  /**
   * Union гостевых и пользовательских избранных.
   * После merge строки гостя удаляются.
   */
  async mergeGuestIntoUser(
    restaurantId: string,
    userId: string,
    guestId: string,
  ): Promise<FavoritesListResponseDto> {
    if (!guestId) {
      throw new BadRequestException('guestId обязателен');
    }

    const guestRows = await this.favoriteRepository.find({
      where: { restaurantId, guestId },
    });

    if (guestRows.length > 0) {
      const userRows = await this.favoriteRepository.find({
        where: { restaurantId, userId },
        select: { menuItemId: true },
      });
      const userSet = new Set(userRows.map((row) => row.menuItemId));

      const toInsert = guestRows
        .filter((row) => !userSet.has(row.menuItemId))
        .map((row) =>
          this.favoriteRepository.create({
            restaurantId,
            menuItemId: row.menuItemId,
            userId,
            guestId: null,
          }),
        );

      if (toInsert.length > 0) {
        await this.favoriteRepository.save(toInsert);
      }

      await this.favoriteRepository.delete({ restaurantId, guestId });
    }

    return this.list(restaurantId, { kind: 'user', userId });
  }

  private findOne(
    restaurantId: string,
    menuItemId: string,
    owner: FavoriteOwner,
  ): Promise<Favorite | null> {
    return this.favoriteRepository.findOne({
      where:
        owner.kind === 'user'
          ? { restaurantId, menuItemId, userId: owner.userId }
          : { restaurantId, menuItemId, guestId: owner.guestId },
    });
  }
}
