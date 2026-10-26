jest.mock('../payments/payments.service', () => ({
  PaymentsService: class PaymentsService {},
}));

import { PreOrdersService } from './pre-orders.service';
describe('PreOrdersService.findByUser', () => {
  const userId = '019efb61-5d8e-7058-b838-6f2696cb4201';
  const restaurantA = '019efb61-5d8e-7058-b838-6f2696cb4204';
  const restaurantB = '019efb61-5d8e-7058-b838-6f2696cb4205';

  const preOrderRepository = {
    find: jest.fn(),
  };
  const preOrderItemRepository = {
    createQueryBuilder: jest.fn(),
  };

  const service = new PreOrdersService(
    preOrderRepository as never,
    preOrderItemRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { emit: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    preOrderRepository.find.mockResolvedValue([]);
    preOrderItemRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
  });

  it('filters by restaurantId when provided', async () => {
    await service.findByUser(userId, restaurantA);

    expect(preOrderRepository.find).toHaveBeenCalledWith({
      where: { userId, restaurantId: restaurantA },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  });

  it('lists all restaurants when restaurantId is omitted', async () => {
    await service.findByUser(userId);

    expect(preOrderRepository.find).toHaveBeenCalledWith({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  });

  it('retries read once on ENOTFOUND', async () => {
    const enotfound = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    preOrderRepository.find
      .mockRejectedValueOnce(enotfound)
      .mockResolvedValueOnce([]);
    preOrderItemRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    await service.findByUser(userId, restaurantB);

    expect(preOrderRepository.find).toHaveBeenCalledTimes(2);
  });
});
