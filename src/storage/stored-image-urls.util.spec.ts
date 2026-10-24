import {
  collectMenuItemImageUrls,
  urlsRemovedByUpdate,
} from './stored-image-urls.util';

describe('stored-image-urls.util', () => {
  it('collects menu item cover and gallery urls', () => {
    const urls = collectMenuItemImageUrls({
      imageUrl: '/uploads/a.jpg',
      imageWebpUrl: '/uploads/a.webp',
      galleryUrls: ['/uploads/g1.jpg', ''],
      galleryWebpUrls: ['/uploads/g1.webp'],
    });

    expect(urls).toEqual([
      '/uploads/a.jpg',
      '/uploads/a.webp',
      '/uploads/g1.jpg',
      '/uploads/g1.webp',
    ]);
  });

  it('urlsRemovedByUpdate returns only urls absent in after', () => {
    expect(
      urlsRemovedByUpdate(
        ['/uploads/old.jpg', '/uploads/keep.jpg'],
        ['/uploads/keep.jpg', '/uploads/new.jpg'],
      ),
    ).toEqual(['/uploads/old.jpg']);
  });
});
