import sharp from 'sharp';

export const RESPONSIVE_IMAGE_SIZES = ['sm', 'md', 'lg'] as const;

export type ResponsiveImageSize = (typeof RESPONSIVE_IMAGE_SIZES)[number];

/** Целевая ширина варианта. Выше исходной ширины не увеличиваем. */
export const RESPONSIVE_IMAGE_WIDTHS: Record<ResponsiveImageSize, number> = {
  sm: 400,
  md: 800,
  lg: 1200,
};

export interface PublicImageVariant {
  width: number;
  webp: string;
  jpg: string;
}

/**
 * Контракт API: null, пока варианты не сгенерированы;
 * объект — после обработки (отдельные размеры опциональны).
 */
export type PublicImageVariants = Partial<
  Record<ResponsiveImageSize, PublicImageVariant>
>;

export interface RenderedImageVariant {
  width: number;
  jpgBuffer: Buffer;
  webpBuffer: Buffer;
}

export type RenderedImageVariants = Partial<
  Record<ResponsiveImageSize, RenderedImageVariant>
>;

const COVER_EXTENSION = /\.(jpe?g|png|webp)$/i;

/**
 * Размеры, которые можно построить без апскейла.
 * Неизвестная ширина — пробуем все целевые, фактическую ширину проверяет рендер.
 */
export function selectResponsiveWidths(
  sourceWidth: number | undefined | null,
): ResponsiveImageSize[] {
  if (
    sourceWidth == null ||
    !Number.isFinite(sourceWidth) ||
    sourceWidth <= 0
  ) {
    return [...RESPONSIVE_IMAGE_SIZES];
  }

  return RESPONSIVE_IMAGE_SIZES.filter(
    (size) => sourceWidth >= RESPONSIVE_IMAGE_WIDTHS[size],
  );
}

export function variantFitsSource(
  actualWidth: number | undefined,
  targetWidth: number,
): boolean {
  return typeof actualWidth === 'number' && actualWidth >= targetWidth;
}

export function responsiveVariantObjectKey(
  keyPrefix: string,
  size: ResponsiveImageSize,
  format: 'jpg' | 'webp',
): string {
  return `${keyPrefix}-${size}.${format}`;
}

/** `menu/r/id-cover.jpg` → `menu/r/id-cover`. */
export function coverObjectKeyPrefix(objectKey: string): string | null {
  const normalized = objectKey.replace(/^\/+/, '');
  if (!COVER_EXTENSION.test(normalized)) {
    return null;
  }
  return normalized.replace(COVER_EXTENSION, '');
}

export function toPublicImageVariants(
  value: unknown,
): PublicImageVariants | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const result: PublicImageVariants = {};

  for (const size of RESPONSIVE_IMAGE_SIZES) {
    const entry = source[size];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const { width, webp, jpg } = record;
    if (typeof width !== 'number' || !Number.isInteger(width) || width <= 0) {
      continue;
    }
    if (typeof webp !== 'string' || webp.length === 0) {
      continue;
    }
    if (typeof jpg !== 'string' || jpg.length === 0) {
      continue;
    }
    result[size] = { width, webp, jpg };
  }

  return result;
}

export async function renderResponsiveVariants(
  buffer: Buffer,
  options: { jpegQuality: number; webpQuality: number },
): Promise<RenderedImageVariants> {
  const base = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await base.metadata();
  const planned = selectResponsiveWidths(metadata.width);
  const rendered: RenderedImageVariants = {};

  await Promise.all(
    planned.map(async (size) => {
      const targetWidth = RESPONSIVE_IMAGE_WIDTHS[size];
      const resized = base.clone().resize({
        width: targetWidth,
        withoutEnlargement: true,
      });
      const jpgBuffer = await resized
        .clone()
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: options.jpegQuality, mozjpeg: true })
        .toBuffer();
      const actual = await sharp(jpgBuffer).metadata();
      if (!variantFitsSource(actual.width, targetWidth)) {
        return;
      }
      const webpBuffer = await resized
        .clone()
        .webp({ quality: options.webpQuality })
        .toBuffer();
      rendered[size] = {
        width: actual.width ?? targetWidth,
        jpgBuffer,
        webpBuffer,
      };
    }),
  );

  return rendered;
}
