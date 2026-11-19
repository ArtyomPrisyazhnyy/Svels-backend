import { ValidationPipe } from '@nestjs/common';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto';
import {
  listCoverAssetUrls,
  toMenuImageUploadResponse,
} from './image-asset-urls';
import { MenuService } from './menu.service';
import type { MenuItem } from './entities/menu-item.entity';

const CATEGORY_ID = '019efb61-5d8e-7058-b838-6f2696cb4205';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('menu imageVariants contract', () => {
  it('accepts the variant map and keeps the cover fields', async () => {
    const dto = (await pipe.transform(
      {
        categoryId: CATEGORY_ID,
        name: 'Бургер',
        price: 12,
        imageUrl: 'https://cdn.example/menu/a-cover.jpg',
        imageWebpUrl: 'https://cdn.example/menu/a-cover.webp',
        imageVariants: {
          sm: {
            width: 400,
            webp: 'https://cdn.example/menu/a-cover-sm.webp',
            jpg: 'https://cdn.example/menu/a-cover-sm.jpg',
          },
          lg: {
            width: 1200,
            webp: 'https://cdn.example/menu/a-cover-lg.webp',
            jpg: 'https://cdn.example/menu/a-cover-lg.jpg',
          },
        },
      },
      { type: 'body', metatype: CreateMenuItemDto },
    )) as CreateMenuItemDto;

    expect(dto).toMatchObject({
      imageUrl: 'https://cdn.example/menu/a-cover.jpg',
      imageWebpUrl: 'https://cdn.example/menu/a-cover.webp',
      imageVariants: {
        sm: {
          width: 400,
          webp: 'https://cdn.example/menu/a-cover-sm.webp',
          jpg: 'https://cdn.example/menu/a-cover-sm.jpg',
        },
        lg: {
          width: 1200,
          webp: 'https://cdn.example/menu/a-cover-lg.webp',
          jpg: 'https://cdn.example/menu/a-cover-lg.jpg',
        },
      },
    });
  });

  it('rejects a size outside sm/md/lg', async () => {
    await expect(
      pipe.transform(
        {
          categoryId: CATEGORY_ID,
          name: 'Бургер',
          price: 12,
          imageUrl: 'https://cdn.example/menu/a-cover.jpg',
          imageVariants: {
            xl: {
              width: 1600,
              webp: 'https://cdn.example/menu/a-xl.webp',
              jpg: 'https://cdn.example/menu/a-xl.jpg',
            },
          },
        },
        { type: 'body', metatype: CreateMenuItemDto },
      ),
    ).rejects.toThrow();
  });

  it('allows null imageVariants on update', async () => {
    const dto = (await pipe.transform(
      { imageVariants: null },
      { type: 'body', metatype: UpdateMenuItemDto },
    )) as UpdateMenuItemDto;
    expect(dto.imageVariants).toBeNull();
  });

  it('upload response keeps cover urls and adds imageVariants', () => {
    expect(
      toMenuImageUploadResponse({
        url: 'https://cdn.example/menu/a-cover.jpg',
        webpUrl: 'https://cdn.example/menu/a-cover.webp',
        imageVariants: {
          sm: {
            width: 400,
            webp: 'https://cdn.example/menu/a-cover-sm.webp',
            jpg: 'https://cdn.example/menu/a-cover-sm.jpg',
          },
        },
      }),
    ).toEqual({
      imageUrl: 'https://cdn.example/menu/a-cover.jpg',
      imageWebpUrl: 'https://cdn.example/menu/a-cover.webp',
      imageVariants: {
        sm: {
          width: 400,
          webp: 'https://cdn.example/menu/a-cover-sm.webp',
          jpg: 'https://cdn.example/menu/a-cover-sm.jpg',
        },
      },
    });
  });
});

describe('MenuService cover variants', () => {
  const categoryRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const itemRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    save: jest.fn((item: MenuItem) => Promise.resolve(item)),
  };
  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
  };
  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };
  const storageService = {
    resolveKeyFromUrl: jest.fn((url: string) => {
      const prefix = 'https://cdn.example/';
      return url.startsWith(prefix) ? url.slice(prefix.length) : null;
    }),
    deleteObject: jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValue(undefined),
  };

  const service = new MenuService(
    categoryRepository as never,
    itemRepository as never,
    cacheService as never,
    nextRevalidationService as never,
    storageService as never,
  );

  const cover = {
    imageUrl: 'https://cdn.example/menu/a-cover.jpg',
    imageWebpUrl: 'https://cdn.example/menu/a-cover.webp',
    imageVariants: {
      sm: {
        width: 400,
        webp: 'https://cdn.example/menu/a-cover-sm.webp',
        jpg: 'https://cdn.example/menu/a-cover-sm.jpg',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.get.mockResolvedValue(null);
  });

  it('returns null imageVariants until they are stored', async () => {
    categoryRepository.find.mockResolvedValue([
      { id: 'cat', restaurantId: 'rest', name: 'Основные', sortOrder: 0 },
    ]);
    itemRepository.find.mockResolvedValue([
      {
        id: 'item',
        restaurantId: 'rest',
        categoryId: 'cat',
        name: 'Суп',
        imageUrl: 'https://cdn.example/menu/a-cover.jpg',
        imageWebpUrl: 'https://cdn.example/menu/a-cover.webp',
        imageVariants: null,
        galleryUrls: [],
        galleryWebpUrls: [],
      },
    ]);

    const menu = await service.getMenuByRestaurant('rest');
    expect(menu.categories[0].items[0].imageUrl).toBe(
      'https://cdn.example/menu/a-cover.jpg',
    );
    expect(menu.categories[0].items[0].imageVariants).toBeNull();
  });

  it('strips unknown variant fields in the menu payload', async () => {
    categoryRepository.find.mockResolvedValue([
      { id: 'cat', restaurantId: 'rest', name: 'Основные', sortOrder: 0 },
    ]);
    itemRepository.find.mockResolvedValue([
      {
        id: 'item',
        categoryId: 'cat',
        imageUrl: cover.imageUrl,
        imageWebpUrl: cover.imageWebpUrl,
        imageVariants: {
          sm: { ...cover.imageVariants.sm, blur: 'nope' },
        },
      },
    ]);

    const menu = await service.getMenuByRestaurant('rest');
    expect(menu.categories[0].items[0].imageVariants).toEqual(
      cover.imageVariants,
    );
    expect(Object.keys(menu.categories[0].items[0].imageVariants!.sm!)).toEqual(
      ['width', 'webp', 'jpg'],
    );
  });

  it('deletes the previous cover and its variants when the photo is replaced', async () => {
    itemRepository.findOne.mockResolvedValue({ ...cover });

    await service.updateItem('rest', 'item', {
      imageUrl: 'https://cdn.example/menu/b-cover.jpg',
      imageWebpUrl: 'https://cdn.example/menu/b-cover.webp',
      imageVariants: {
        md: {
          width: 800,
          webp: 'https://cdn.example/menu/b-cover-md.webp',
          jpg: 'https://cdn.example/menu/b-cover-md.jpg',
        },
      },
    });

    const deleted = storageService.deleteObject.mock.calls.map(
      (call) => call[0],
    );
    expect(deleted.sort()).toEqual(
      [
        'menu/a-cover.jpg',
        'menu/a-cover.webp',
        'menu/a-cover-sm.jpg',
        'menu/a-cover-sm.webp',
      ].sort(),
    );
    expect(deleted).not.toContain('menu/b-cover-md.webp');
  });

  it('drops stored variants when the cover changes without a new map', async () => {
    itemRepository.findOne.mockResolvedValue({ ...cover });

    const saved = await service.updateItem('rest', 'item', {
      imageUrl: 'https://cdn.example/menu/b-cover.jpg',
    });

    expect(saved.imageVariants).toBeNull();
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'menu/a-cover-sm.webp',
    );
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'menu/a-cover.jpg',
    );
  });

  it('deletes variant objects when the menu item is removed', async () => {
    itemRepository.findOne.mockResolvedValue({ ...cover });
    itemRepository.delete.mockResolvedValue({ affected: 1 });

    await service.deleteItem('rest', 'item');

    expect(listCoverAssetUrls(cover)).toHaveLength(4);
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'menu/a-cover-sm.webp',
    );
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'menu/a-cover-sm.jpg',
    );
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'menu/a-cover.jpg',
    );
  });
});
