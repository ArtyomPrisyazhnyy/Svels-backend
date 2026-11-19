import sharp from 'sharp';
import {
  coverObjectKeyPrefix,
  renderResponsiveVariants,
  responsiveVariantObjectKey,
  selectResponsiveWidths,
  toPublicImageVariants,
  variantFitsSource,
} from './responsive-image-variants';

async function solidJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 90, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('responsive image widths', () => {
  it('keeps sm/md/lg only when the source is at least that wide', () => {
    expect(selectResponsiveWidths(1199)).toEqual(['sm', 'md']);
    expect(selectResponsiveWidths(1200)).toEqual(['sm', 'md', 'lg']);
    expect(selectResponsiveWidths(400)).toEqual(['sm']);
    expect(selectResponsiveWidths(399)).toEqual([]);
    expect(variantFitsSource(399, 400)).toBe(false);
    expect(variantFitsSource(400, 400)).toBe(true);
  });

  it('does not upscale and writes webp plus jpg at the target width', async () => {
    const narrow = await renderResponsiveVariants(await solidJpeg(350, 200), {
      jpegQuality: 70,
      webpQuality: 70,
    });
    expect(narrow).toEqual({});

    const medium = await renderResponsiveVariants(await solidJpeg(1000, 640), {
      jpegQuality: 70,
      webpQuality: 70,
    });
    expect(medium.lg).toBeUndefined();
    expect(medium.sm?.width).toBe(400);
    expect(medium.md?.width).toBe(800);

    const smJpg = await sharp(medium.sm!.jpgBuffer).metadata();
    const smWebp = await sharp(medium.sm!.webpBuffer).metadata();
    expect(smJpg.format).toBe('jpeg');
    expect(smJpg.width).toBe(400);
    expect(smWebp.format).toBe('webp');
    expect(smWebp.width).toBe(400);

    const wide = await renderResponsiveVariants(await solidJpeg(2000, 1000), {
      jpegQuality: 70,
      webpQuality: 70,
    });
    expect(wide.sm?.width).toBe(400);
    expect(wide.md?.width).toBe(800);
    expect(wide.lg?.width).toBe(1200);
  });

  it('places variant keys next to the existing cover prefix', () => {
    expect(coverObjectKeyPrefix('menu/rest/item-cover.jpg')).toBe(
      'menu/rest/item-cover',
    );
    expect(coverObjectKeyPrefix('menu/rest/item-cover.webp')).toBe(
      'menu/rest/item-cover',
    );
    expect(
      responsiveVariantObjectKey('menu/rest/item-cover', 'sm', 'webp'),
    ).toBe('menu/rest/item-cover-sm.webp');
    expect(
      responsiveVariantObjectKey('menu/rest/item-cover', 'lg', 'jpg'),
    ).toBe('menu/rest/item-cover-lg.jpg');
  });
});

describe('imageVariants API contract', () => {
  it('returns null or exactly width/webp/jpg per size', () => {
    expect(toPublicImageVariants(null)).toBeNull();
    expect(toPublicImageVariants(undefined)).toBeNull();

    const variants = toPublicImageVariants({
      sm: {
        width: 400,
        webp: 'https://cdn.example/menu/a-sm.webp',
        jpg: 'https://cdn.example/menu/a-sm.jpg',
        extra: 'drop-me',
      },
      xl: {
        width: 2000,
        webp: 'https://cdn.example/menu/a-xl.webp',
        jpg: 'https://cdn.example/menu/a-xl.jpg',
      },
      md: { width: 800, webp: '', jpg: 'https://cdn.example/menu/a-md.jpg' },
    });

    expect(variants).toEqual({
      sm: {
        width: 400,
        webp: 'https://cdn.example/menu/a-sm.webp',
        jpg: 'https://cdn.example/menu/a-sm.jpg',
      },
    });
    expect(Object.keys(variants!.sm!)).toEqual(['width', 'webp', 'jpg']);
  });
});
