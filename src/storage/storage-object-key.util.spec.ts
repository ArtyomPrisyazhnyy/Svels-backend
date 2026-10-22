import {
  buildPublicMediaUrl,
  extractObjectKeyFromValue,
  normalizeStorageKey,
} from './storage-object-key.util';

describe('storage-object-key.util', () => {
  it('normalizes keys', () => {
    expect(normalizeStorageKey('/uploads/menu/x.jpg')).toBe('menu/x.jpg');
    expect(normalizeStorageKey('menu/x.jpg')).toBe('menu/x.jpg');
  });

  it('builds local and s3 public URLs', () => {
    expect(buildPublicMediaUrl('local', 'menu/a.webp', 'https://unused')).toBe(
      '/uploads/menu/a.webp',
    );
    expect(
      buildPublicMediaUrl(
        's3',
        'venues/1/products/a.webp',
        'https://img.example.com',
      ),
    ).toBe('https://img.example.com/venues/1/products/a.webp');
  });

  it('extracts keys from uploads path and public base', () => {
    expect(extractObjectKeyFromValue('/uploads/menu/x.jpg')).toBe('menu/x.jpg');
    expect(
      extractObjectKeyFromValue('https://img.example.com/menu/x.jpg', {
        publicBaseUrl: 'https://img.example.com',
      }),
    ).toBe('menu/x.jpg');
    expect(extractObjectKeyFromValue('menu/x.jpg')).toBe('menu/x.jpg');
  });

  it('extracts keys from legacy Yandex URLs', () => {
    expect(
      extractObjectKeyFromValue(
        'https://storage.yandexcloud.net/my-bucket/menu/x.webp',
        { bucket: 'my-bucket' },
      ),
    ).toBe('menu/x.webp');
  });
});
