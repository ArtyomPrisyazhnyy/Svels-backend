import {
  RESPONSIVE_IMAGE_SIZES,
  type PublicImageVariants,
} from '../media/responsive-image-variants';

export function listCoverAssetUrls(item: {
  imageUrl?: string | null;
  imageWebpUrl?: string | null;
  imageVariants?: PublicImageVariants | null;
}): string[] {
  const urls: string[] = [];
  if (item.imageUrl) {
    urls.push(item.imageUrl);
  }
  if (item.imageWebpUrl) {
    urls.push(item.imageWebpUrl);
  }
  const variants = item.imageVariants;
  if (!variants) {
    return urls;
  }
  for (const size of RESPONSIVE_IMAGE_SIZES) {
    const variant = variants[size];
    if (!variant) {
      continue;
    }
    urls.push(variant.webp, variant.jpg);
  }
  return urls;
}

export function toMenuImageUploadResponse(uploaded: {
  url: string;
  webpUrl: string;
  imageVariants: PublicImageVariants | null;
}): {
  imageUrl: string;
  imageWebpUrl: string;
  imageVariants: PublicImageVariants | null;
} {
  return {
    imageUrl: uploaded.url,
    imageWebpUrl: uploaded.webpUrl,
    imageVariants: uploaded.imageVariants,
  };
}
