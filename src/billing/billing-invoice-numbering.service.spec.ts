import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BillingInvoiceNumberingService } from './billing-invoice-numbering.service';
import { BillingInvoiceSequence } from './entities/billing-invoice-sequence.entity';

describe('BillingInvoiceNumberingService', () => {
  let service: BillingInvoiceNumberingService;
  const sequenceRepo = {
    findOne: jest.fn(),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => row),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingInvoiceNumberingService,
        {
          provide: getRepositoryToken(BillingInvoiceSequence),
          useValue: sequenceRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(BillingInvoiceNumberingService);
  });

  it('formats display number with zero padding', () => {
    expect(service.formatDisplayNumber(2026, 3)).toBe('2026-0003');
  });

  it('allocates sequential numbers per year in a transaction', async () => {
    sequenceRepo.findOne.mockResolvedValue({ invoiceYear: 2026, lastNumber: 5 });
    const manager = {
      getRepository: () => sequenceRepo,
    };

    const allocation = await service.allocateNextNumber(
      manager as unknown as DataSource,
      new Date('2026-04-10T00:00:00.000Z'),
    );

    expect(allocation).toEqual({
      invoiceYear: 2026,
      sequenceNumber: 6,
      displayNumber: '2026-0006',
    });
    expect(sequenceRepo.save).toHaveBeenCalledWith({
      invoiceYear: 2026,
      lastNumber: 6,
    });
  });
});
