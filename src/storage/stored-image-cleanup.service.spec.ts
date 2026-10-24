import { StoredImageCleanupService } from './stored-image-cleanup.service';
import { StorageService } from './storage.service';

describe('StoredImageCleanupService', () => {
  const storageService = {
    resolveKeyFromUrl: jest.fn((url: string) => {
      if (url.startsWith('/uploads/')) {
        return url.slice('/uploads/'.length);
      }
      return null;
    }),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };

  const dataSource = {
    query: jest.fn(),
  };

  const service = new StoredImageCleanupService(
    storageService as unknown as StorageService,
    dataSource as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes storage keys for removed urls but retains new urls', async () => {
    await service.deleteReplacedUrls(
      ['/uploads/menu/old.jpg', '/uploads/menu/old.webp'],
      ['/uploads/menu/new.jpg', '/uploads/menu/new.webp'],
    );

    expect(storageService.deleteObject).toHaveBeenCalledTimes(2);
    expect(storageService.deleteObject).toHaveBeenCalledWith('menu/old.jpg');
    expect(storageService.deleteObject).toHaveBeenCalledWith('menu/old.webp');
    expect(storageService.deleteObject).not.toHaveBeenCalledWith(
      'menu/new.jpg',
    );
  });

  it('skips external urls', async () => {
    await service.deleteByUrls(['https://cdn.example/photo.jpg']);

    expect(storageService.deleteObject).not.toHaveBeenCalled();
  });

  it('collectRestaurantImageUrls aggregates logo, menu and banners', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        { logoUrl: '/uploads/logo.jpg', logoWebpUrl: null },
      ])
      .mockResolvedValueOnce([
        {
          imageUrl: '/uploads/item.jpg',
          imageWebpUrl: null,
          galleryUrls: [],
          galleryWebpUrls: [],
        },
      ])
      .mockResolvedValueOnce([
        { imageUrl: '/uploads/banner.jpg', imageWebpUrl: null },
      ]);

    const urls = await service.collectRestaurantImageUrls('rest-id');

    expect(urls).toEqual([
      '/uploads/logo.jpg',
      '/uploads/item.jpg',
      '/uploads/banner.jpg',
    ]);
  });
});
