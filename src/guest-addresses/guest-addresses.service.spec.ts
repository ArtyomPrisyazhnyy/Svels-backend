import { DataSource, Repository } from 'typeorm';
import { GuestAddress } from './entities/guest-address.entity';
import { GuestAddressesService } from './guest-addresses.service';

describe('GuestAddressesService', () => {
  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';
  const userId = '019efb61-5d8e-7058-b838-6f2696cb4205';
  const otherUserId = '019efb61-5d8e-7058-b838-6f2696cb4206';

  let repository: {
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
  };
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    softRemove: jest.Mock;
    find: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let service: GuestAddressesService;

  const baseAddress = (): GuestAddress => ({
    id: '019efb61-5d8e-7058-b838-6f2696cb4300',
    restaurantId,
    userId,
    label: null,
    street: 'Ленина',
    house: '1',
    apartment: null,
    entrance: null,
    floor: null,
    intercom: null,
    comment: null,
    lat: null,
    lng: null,
    isDefault: true,
    lastUsedAt: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    deletedAt: null,
  });

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
    };
    manager = {
      create: jest.fn((_entity: unknown, data: GuestAddress) => data),
      save: jest.fn((entity: GuestAddress) =>
        Promise.resolve({
          ...entity,
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
          updatedAt: new Date('2026-01-01T10:00:00.000Z'),
        }),
      ),
      update: jest.fn(),
      softRemove: jest.fn(),
      find: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)),
    };
    service = new GuestAddressesService(
      repository as unknown as Repository<GuestAddress>,
      dataSource as unknown as DataSource,
    );
  });

  it('creates first address as default', async () => {
    repository.find.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    const result = await service.create(restaurantId, userId, {
      street: 'Ленина',
      house: '1',
    });

    expect(result.created).toBe(true);
    expect(result.dto.isDefault).toBe(true);
  });

  it('returns existing address on duplicate create', async () => {
    const existing = baseAddress();
    repository.find.mockResolvedValue([existing]);

    const result = await service.create(restaurantId, userId, {
      street: 'ленина',
      house: '1',
    });

    expect(result.created).toBe(false);
    expect(result.dto.id).toBe(existing.id);
  });

  it('throws ADDRESS_LIMIT when at capacity', async () => {
    repository.find.mockResolvedValue([]);
    repository.count.mockResolvedValue(10);

    await expect(
      service.create(restaurantId, userId, { street: 'Новая', house: '2' }),
    ).rejects.toMatchObject({ response: { code: 'ADDRESS_LIMIT' } });
  });

  it('throws ADDRESS_NOT_FOUND for foreign address on update', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.update(
        restaurantId,
        userId,
        '019efb61-5d8e-7058-b838-6f2696cb4999',
        {
          street: 'X',
        },
      ),
    ).rejects.toMatchObject({ response: { code: 'ADDRESS_NOT_FOUND' } });
  });

  it('reassigns default after deleting default address', async () => {
    const current = baseAddress();
    const next = {
      ...baseAddress(),
      id: '019efb61-5d8e-7058-b838-6f2696cb4301',
      isDefault: false,
      lastUsedAt: new Date('2026-02-01T10:00:00.000Z'),
    };
    repository.findOne.mockResolvedValue(current);
    manager.find.mockResolvedValue([next]);
    manager.save.mockResolvedValue(next);

    await service.remove(restaurantId, userId, current.id);

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: next.id, isDefault: true }),
    );
  });

  it('sets default in a transaction', async () => {
    const address = { ...baseAddress(), isDefault: false };
    repository.findOne.mockResolvedValue(address);
    manager.save.mockImplementation((entity: GuestAddress) =>
      Promise.resolve(entity),
    );

    const dto = await service.setDefault(restaurantId, userId, address.id);

    expect(manager.update).toHaveBeenCalled();
    expect(dto.isDefault).toBe(true);
  });

  it('findSnapshotForOrder returns null for other guest', async () => {
    repository.findOne.mockResolvedValue(null);

    const snapshot = await service.findSnapshotForOrder(
      otherUserId,
      restaurantId,
      '019efb61-5d8e-7058-b838-6f2696cb4300',
      new Date(),
    );

    expect(snapshot).toBeNull();
  });

  it('touchOrSave skips when limit reached', async () => {
    repository.find.mockResolvedValue([]);
    repository.count.mockResolvedValue(10);

    await service.touchOrSave({
      userId,
      restaurantId,
      snapshot: { street: 'Новая', house: '9' },
      now: new Date(),
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
