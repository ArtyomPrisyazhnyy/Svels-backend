import { ImagePipelineService } from './image-pipeline.service';

describe('ImagePipelineService', () => {
  const conversionService = {
    convert: jest.fn(),
    buildResponsiveVariants: jest.fn(),
  };
  const storageService = {
    putObject: jest.fn(({ key }: { key: string }) =>
      Promise.resolve({
        key,
        url: `https://cdn.example/${key}`,
      }),
    ),
  };

  const pipeline = new ImagePipelineService(
    conversionService as never,
    storageService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    conversionService.convert.mockResolvedValue({
      fallbackBuffer: Buffer.from('jpg'),
      fallbackContentType: 'image/jpeg',
      fallbackExtension: '.jpg',
      webpBuffer: Buffer.from('webp'),
    });
    conversionService.buildResponsiveVariants.mockResolvedValue({
      sm: {
        width: 400,
        jpgBuffer: Buffer.from('sm-jpg'),
        webpBuffer: Buffer.from('sm-webp'),
      },
      md: {
        width: 800,
        jpgBuffer: Buffer.from('md-jpg'),
        webpBuffer: Buffer.from('md-webp'),
      },
    });
  });

  it('keeps the cover object and stores absolute sm/md/lg urls', async () => {
    const result = await pipeline.processAndStore({
      buffer: Buffer.from('original'),
      keyPrefix: 'menu/rest/item-cover',
      mimeType: 'image/jpeg',
      responsiveVariants: true,
    });

    const keys = storageService.putObject.mock.calls.map((call) => call[0].key);
    expect(keys).toEqual([
      'menu/rest/item-cover.jpg',
      'menu/rest/item-cover.webp',
      'menu/rest/item-cover-sm.jpg',
      'menu/rest/item-cover-sm.webp',
      'menu/rest/item-cover-md.jpg',
      'menu/rest/item-cover-md.webp',
    ]);
    expect(result.fallbackUrl).toBe(
      'https://cdn.example/menu/rest/item-cover.jpg',
    );
    expect(result.webpUrl).toBe(
      'https://cdn.example/menu/rest/item-cover.webp',
    );
    expect(result.imageVariants).toEqual({
      sm: {
        width: 400,
        jpg: 'https://cdn.example/menu/rest/item-cover-sm.jpg',
        webp: 'https://cdn.example/menu/rest/item-cover-sm.webp',
      },
      md: {
        width: 800,
        jpg: 'https://cdn.example/menu/rest/item-cover-md.jpg',
        webp: 'https://cdn.example/menu/rest/item-cover-md.webp',
      },
    });
  });

  it('does not build width variants for non-menu uploads', async () => {
    const result = await pipeline.processAndStore({
      buffer: Buffer.from('logo'),
      keyPrefix: 'restaurants/rest/logo/id',
      mimeType: 'image/png',
      responsiveVariants: false,
    });

    expect(conversionService.buildResponsiveVariants).not.toHaveBeenCalled();
    expect(result.imageVariants).toBeNull();
    expect(storageService.putObject).toHaveBeenCalledTimes(2);
  });
});
