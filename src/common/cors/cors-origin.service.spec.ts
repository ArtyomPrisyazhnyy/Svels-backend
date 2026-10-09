import { CorsOriginService, normalizeOrigin } from './cors-origin.service';
import type { RestaurantsDomainResolver } from '../interfaces/restaurants-domain-resolver.interface';

describe('CorsOriginService', () => {
  const createService = (
    resolver: RestaurantsDomainResolver,
    envOrigins?: string,
  ) => {
    const previous = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS = envOrigins ?? '';
    try {
      return new CorsOriginService(resolver);
    } finally {
      process.env.CORS_ALLOWED_ORIGINS = previous;
    }
  };

  it('allows static origins from CORS_ALLOWED_ORIGINS', async () => {
    const resolveByDomain = jest.fn().mockRejectedValue(new Error('not found'));
    const service = createService(
      { resolveByDomain },
      'https://app.example.com,https://admin.example.com',
    );

    await expect(
      service.isOriginAllowed('https://app.example.com'),
    ).resolves.toBe(true);
    await expect(
      service.isOriginAllowed('https://evil.example.com'),
    ).resolves.toBe(false);
    expect(resolveByDomain).toHaveBeenCalledWith('evil.example.com');
  });

  it('allows custom domain when resolveByDomain succeeds', async () => {
    const resolveByDomain = jest.fn().mockResolvedValue({ id: 'r1' });
    const service = createService({ resolveByDomain });

    await expect(
      service.isOriginAllowed('https://cafe.example.by'),
    ).resolves.toBe(true);
    expect(resolveByDomain).toHaveBeenCalledWith('cafe.example.by');
  });

  it('rejects http origins for custom domain resolution', async () => {
    const resolveByDomain = jest.fn().mockResolvedValue({ id: 'r1' });
    const service = createService({ resolveByDomain });

    await expect(
      service.isOriginAllowed('http://cafe.example.by'),
    ).resolves.toBe(false);
    expect(resolveByDomain).not.toHaveBeenCalled();
  });

  it('evicts oldest origin cache entries after 1000 items', async () => {
    const resolveByDomain = jest.fn().mockResolvedValue({ id: 'r1' });
    const service = createService({ resolveByDomain });

    const firstOrigin = 'https://site0.example.com';
    await service.isOriginAllowed(firstOrigin);
    expect(resolveByDomain).toHaveBeenCalledTimes(1);

    for (let i = 1; i <= 1000; i += 1) {
      await service.isOriginAllowed(`https://site${i}.example.com`);
    }

    resolveByDomain.mockClear();
    await service.isOriginAllowed(firstOrigin);
    expect(resolveByDomain).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown origin without ACAO (not in whitelist, domain unresolved)', async () => {
    const resolveByDomain = jest.fn().mockRejectedValue(new Error('not found'));
    const resolver: RestaurantsDomainResolver = { resolveByDomain };
    const service = createService(resolver);

    await expect(
      service.isOriginAllowed('https://attacker.example'),
    ).resolves.toBe(false);
  });

  it('normalizeOrigin strips trailing slash via URL origin', () => {
    expect(normalizeOrigin('https://app.example.com/')).toBe(
      'https://app.example.com',
    );
  });
});
