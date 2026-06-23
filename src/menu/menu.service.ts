import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { sanitizeText } from '../common/utils/sanitize.util';
import { CreateMenuCategoryDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuItem } from './entities/menu-item.entity';
import { normalizeModifierGroups, normalizeNutrition } from './utils/menu-item.util';

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
  ) {}

  async getMenuByRestaurant(restaurantId: string): Promise<MenuWithCategories> {
    const cacheKey = CacheKeys.menu(restaurantId);
    const cached = await this.cacheService.get<MenuWithCategories>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.categoryRepository.find({
      where: { restaurantId },
      order: { sortOrder: 'ASC' },
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
    const category = this.categoryRepository.create({
      restaurantId,
      name: sanitizeText(dto.name),
      sortOrder: dto.sortOrder ?? 0,
    });

    const saved = await this.categoryRepository.save(category);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async createItem(restaurantId: string, dto: CreateMenuItemDto): Promise<MenuItem> {
    await this.ensureCategoryBelongsToRestaurant(restaurantId, dto.categoryId);

    const item = this.itemRepository.create({
      restaurantId,
      categoryId: dto.categoryId,
      name: sanitizeText(dto.name),
      description: dto.description ? sanitizeText(dto.description) : null,
      ingredients: dto.ingredients ? sanitizeText(dto.ingredients) : null,
      nutrition: normalizeNutrition(dto.nutrition),
      price: dto.price,
      isAvailable: dto.isAvailable ?? true,
      imageUrl: dto.imageUrl,
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
      await this.ensureCategoryBelongsToRestaurant(restaurantId, dto.categoryId);
      item.categoryId = dto.categoryId;
    }
    if (dto.name) item.name = sanitizeText(dto.name);
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
    if (dto.isAvailable !== undefined) item.isAvailable = dto.isAvailable;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl;
    if (dto.modifierGroups !== undefined) {
      item.modifierGroups = normalizeModifierGroups(dto.modifierGroups);
    }

    const saved = await this.itemRepository.save(item);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async deleteItem(restaurantId: string, itemId: string): Promise<void> {
    const result = await this.itemRepository.delete({ id: itemId, restaurantId });
    if (!result.affected) {
      throw new NotFoundException('Позиция меню не найдена');
    }
    await this.invalidateCache(restaurantId);
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
  }
}
