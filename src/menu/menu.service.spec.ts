jest.mock('./utils/menu-item.util', () => ({
  normalizeModifierGroups: (value: unknown) => value,
  normalizeNutrition: (value: unknown) => value,
}));

import { MenuService } from './menu.service';
import type { MenuCategory } from './entities/menu-category.entity';

describe('MenuService categories', () => {
  const categoryRepository = {
    find: jest.fn(),
    maximum: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const itemRepository = { find: jest.fn() };
  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
  };
  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new MenuService(
    categoryRepository as never,
    itemRepository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    itemRepository.find.mockResolvedValue([]);
  });

  it('assigns sortOrder as max + 1 when creating a category', async () => {
    categoryRepository.maximum.mockResolvedValue(3);
    categoryRepository.create.mockImplementation(
      (value: Partial<MenuCategory>) => value,
    );
    categoryRepository.save.mockImplementation((value: Partial<MenuCategory>) =>
      Promise.resolve({
        ...value,
        id: 'cat-new',
        createdAt: new Date('2026-01-02'),
        updatedAt: new Date('2026-01-02'),
      } as MenuCategory),
    );

    const saved = await service.createCategory('rest-id', { name: 'Desserts' });

    expect(categoryRepository.maximum).toHaveBeenCalledWith('sortOrder', {
      restaurantId: 'rest-id',
    });
    expect(saved.sortOrder).toBe(4);
  });

  it('orders categories by sortOrder, createdAt, id when loading menu', async () => {
    categoryRepository.find.mockResolvedValue([]);

    await service.getMenuByRestaurant('rest-id');

    expect(categoryRepository.find).toHaveBeenCalledWith({
      where: { restaurantId: 'rest-id' },
      order: { sortOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
  });
});
