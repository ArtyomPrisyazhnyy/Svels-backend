import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { NextRevalidationService } from '../next-revalidation/next-revalidation.service';
import { sanitizeText } from '../common/utils/sanitize.util';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';
import {
  ReorderMenuCategoriesDto,
  UpdateMenuCategoryDto,
} from './dto/menu-category.dto';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuItem } from './entities/menu-item.entity';
import {
  normalizeModifierGroups,
  normalizeNutrition,
} from './utils/menu-item.util';

export interface MenuWithCategories {
  categories: Array<MenuCategory & { items: MenuItem[] }>;
}

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly categoryRepository: Repository<MenuCategory>,
    @InjectRepository(MenuItem)
    private readonly itemRepository: Repository<MenuItem>,
    private readonly cacheService: CacheService,
    private readonly nextRevalidationService: NextRevalidationService,
  ) {}

  async getMenuByRestaurant(restaurantId: string): Promise<MenuWithCategories> {
    const cacheKey = CacheKeys.menu(restaurantId);
    const cached = await this.cacheService.get<MenuWithCategories>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.categoryRepository.find({
      where: { restaurantId },
      order: { sortOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });

    const items = await this.itemRepository.find({
      where: { restaurantId },
      order: { name: 'ASC' },
    });

    const result: MenuWithCategories = {
      categories: categories.map((category) => ({
        ...category,
        items: items.filter((item) => item.categoryId === category.id),
      })),
    };

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async createCategory(
    restaurantId: string,
    dto: CreateMenuCategoryDto,
  ): Promise<MenuCategory> {
    const maxSortOrder = await this.categoryRepository.maximum('sortOrder', {
      restaurantId,
    });
    const nextSortOrder =
      dto.sortOrder ?? (maxSortOrder === null ? 0 : maxSortOrder + 1);

    const category = this.categoryRepository.create({
      restaurantId,
      name: sanitizeText(dto.name),
      sortOrder: nextSortOrder,
    });

    const saved = await this.categoryRepository.save(category);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async updateCategory(
    restaurantId: string,
    categoryId: string,
    dto: UpdateMenuCategoryDto,
  ): Promise<MenuCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, restaurantId },
    });
    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    if (dto.name !== undefined) {
      category.name = sanitizeText(dto.name);
    }
    if (dto.sortOrder !== undefined) {
      category.sortOrder = dto.sortOrder;
    }

    const saved = await this.categoryRepository.save(category);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async deleteCategory(
    restaurantId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, restaurantId },
    });
    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    const itemsCount = await this.itemRepository.count({
      where: { categoryId, restaurantId },
    });
    if (itemsCount > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Нельзя удалить категорию с позициями меню',
        error: 'Conflict',
        code: 'CATEGORY_NOT_EMPTY',
      });
    }

    await this.categoryRepository.delete({ id: categoryId, restaurantId });
    await this.invalidateCache(restaurantId);
  }

  async reorderCategories(
    restaurantId: string,
    dto: ReorderMenuCategoriesDto,
  ): Promise<void> {
    const categories = await this.categoryRepository.find({
      where: { restaurantId },
    });

    if (categories.length !== dto.ids.length) {
      throw new BadRequestException('Список категорий не совпадает с меню');
    }

    const knownIds = new Set(categories.map((category) => category.id));
    for (const id of dto.ids) {
      if (!knownIds.has(id)) {
        throw new BadRequestException('Список категорий не совпадает с меню');
      }
    }

    await this.categoryRepository.manager.transaction(async (manager) => {
      for (let index = 0; index < dto.ids.length; index += 1) {
        await manager.update(
          MenuCategory,
          { id: dto.ids[index], restaurantId },
          { sortOrder: index },
        );
      }
    });

    await this.invalidateCache(restaurantId);
  }

  async createItem(
    restaurantId: string,
    dto: CreateMenuItemDto,
  ): Promise<MenuItem> {
    await this.ensureCategoryBelongsToRestaurant(restaurantId, dto.categoryId);

    const oldPrice = this.normalizeOldPrice(dto.price, dto.oldPrice);

    const item = this.itemRepository.create({
      restaurantId,
      categoryId: dto.categoryId,
      name: sanitizeText(dto.name),
      variantLabel: dto.variantLabel ? sanitizeText(dto.variantLabel) : null,
      description: dto.description ? sanitizeText(dto.description) : null,
      ingredients: dto.ingredients ? sanitizeText(dto.ingredients) : null,
      nutrition: normalizeNutrition(dto.nutrition),
      price: dto.price,
      oldPrice,
      isAvailable: dto.isAvailable ?? true,
      imageUrl: dto.imageUrl,
      imageWebpUrl: dto.imageWebpUrl ?? null,
      galleryUrls: dto.galleryUrls ?? [],
      galleryWebpUrls: dto.galleryWebpUrls ?? [],
      modifierGroups: normalizeModifierGroups(dto.modifierGroups),
    });

    const saved = await this.itemRepository.save(item);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async updateItem(
    restaurantId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId, restaurantId },
    });

    if (!item) {
      throw new NotFoundException('Позиция меню не найдена');
    }

    if (dto.categoryId) {
      await this.ensureCategoryBelongsToRestaurant(
        restaurantId,
        dto.categoryId,
      );
      item.categoryId = dto.categoryId;
    }
    if (dto.name) item.name = sanitizeText(dto.name);
    if (dto.variantLabel !== undefined) {
      item.variantLabel = dto.variantLabel
        ? sanitizeText(dto.variantLabel)
        : null;
    }
    if (dto.description !== undefined) {
      item.description = dto.description ? sanitizeText(dto.description) : null;
    }
    if (dto.ingredients !== undefined) {
      item.ingredients = dto.ingredients ? sanitizeText(dto.ingredients) : null;
    }
    if (dto.nutrition !== undefined) {
      item.nutrition = normalizeNutrition(dto.nutrition);
    }
    if (dto.price !== undefined) item.price = dto.price;
    if (dto.oldPrice !== undefined) {
      item.oldPrice = this.normalizeOldPrice(Number(item.price), dto.oldPrice);
    } else if (dto.price !== undefined && item.oldPrice !== null) {
      item.oldPrice = this.normalizeOldPrice(
        Number(item.price),
        Number(item.oldPrice),
      );
    }
    if (dto.isAvailable !== undefined) item.isAvailable = dto.isAvailable;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl;
    if (dto.imageWebpUrl !== undefined) item.imageWebpUrl = dto.imageWebpUrl;
    if (dto.galleryUrls !== undefined) item.galleryUrls = dto.galleryUrls;
    if (dto.galleryWebpUrls !== undefined)
      item.galleryWebpUrls = dto.galleryWebpUrls;
    if (dto.modifierGroups !== undefined) {
      item.modifierGroups = normalizeModifierGroups(dto.modifierGroups);
    }

    const saved = await this.itemRepository.save(item);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async deleteItem(restaurantId: string, itemId: string): Promise<void> {
    const result = await this.itemRepository.delete({
      id: itemId,
      restaurantId,
    });
    if (!result.affected) {
      throw new NotFoundException('Позиция меню не найдена');
    }
    await this.invalidateCache(restaurantId);
  }

  /** Проверка принадлежности позиции ресторану без JOIN из чужих модулей. */
  async assertItemBelongsToRestaurant(
    restaurantId: string,
    menuItemId: string,
  ): Promise<void> {
    const item = await this.itemRepository.findOne({
      where: { id: menuItemId, restaurantId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Позиция меню не найдена');
    }
  }

  private normalizeOldPrice(
    price: number,
    oldPrice: number | null | undefined,
  ): number | null {
    if (oldPrice === undefined || oldPrice === null) {
      return null;
    }

    if (Number(oldPrice) <= Number(price)) {
      throw new BadRequestException(
        'Старая цена должна быть больше актуальной',
      );
    }

    return oldPrice;
  }

  private async ensureCategoryBelongsToRestaurant(
    restaurantId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, restaurantId },
    });

    if (!category) {
      throw new BadRequestException('Категория не найдена в этом ресторане');
    }
  }

  private async invalidateCache(restaurantId: string): Promise<void> {
    await this.cacheService.del(CacheKeys.menu(restaurantId));
    await this.nextRevalidationService.revalidateRestaurantPublicPage(
      restaurantId,
    );
  }
}
