import { resolveObjectKeyFromUrl } from './object-key-from-url';

const ctx = {
  bucket: 'svels-media',
  publicBaseUrl: 'https://cdn.example.com/svels-media',
  legacyPublicBaseUrls: ['https://storage.yandexcloud.net/svels-media'],
};

describe('resolveObjectKeyFromUrl', () => {
  it('resolves current public base URL', () => {
    expect(
      resolveObjectKeyFromUrl(
        'https://cdn.example.com/svels-media/menu/a.jpg',
        ctx,
      ),
    ).toBe('menu/a.jpg');
  });

  it('resolves legacy Yandex path-style URL', () => {
    expect(
      resolveObjectKeyFromUrl(
        'https://storage.yandexcloud.net/svels-media/menu/a.jpg',
        ctx,
      ),
    ).toBe('menu/a.jpg');
  });

  it('resolves legacy Yandex virtual-hosted URL', () => {
    expect(
      resolveObjectKeyFromUrl(
        'https://svels-media.storage.yandexcloud.net/menu/a.jpg',
        ctx,
      ),
    ).toBe('menu/a.jpg');
  });

  it('resolves local uploads path', () => {
    expect(resolveObjectKeyFromUrl('/uploads/menu/a.jpg', ctx)).toBe(
      'menu/a.jpg',
    );
  });

  it('returns null for unrelated URL', () => {
    expect(
      resolveObjectKeyFromUrl('https://other.example/object.jpg', ctx),
    ).toBeNull();
  });
});
