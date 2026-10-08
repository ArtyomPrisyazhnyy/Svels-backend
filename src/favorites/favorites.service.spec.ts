import { UnauthorizedException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  const favoriteRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const menuService = {
    assertItemBelongsToRestaurant: jest.fn(),
  };

  const service = new FavoritesService(
    favoriteRepository as never,
    menuService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolveOwner prefers authenticated user over guest id', () => {
    expect(
      service.resolveOwner({ id: 'user-1' } as never, 'guest-1'),
    ).toEqual({ kind: 'user', userId: 'user-1' });
  });

  it('resolveOwner uses guest when there is no user', () => {
    expect(service.resolveOwner(null, 'guest-1')).toEqual({
      kind: 'guest',
      guestId: 'guest-1',
    });
  });

  it('resolveOwner rejects anonymous request', () => {
    expect(() => service.resolveOwner(null, undefined)).toThrow(
      UnauthorizedException,
    );
  });
});
