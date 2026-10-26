import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BillingInvoiceSequence } from './entities/billing-invoice-sequence.entity';

export interface InvoiceNumberAllocation {
  invoiceYear: number;
  sequenceNumber: number;
  displayNumber: string;
}

@Injectable()
export class BillingInvoiceNumberingService {
  constructor(
    @InjectRepository(BillingInvoiceSequence)
    private readonly sequenceRepository: Repository<BillingInvoiceSequence>,
  ) {}

  formatDisplayNumber(invoiceYear: number, sequenceNumber: number): string {
    const padded = String(sequenceNumber).padStart(4, '0');
    return `${invoiceYear}-${padded}`;
  }

  async allocateNextNumber(
    manager: EntityManager,
    referenceDate: Date = new Date(),
  ): Promise<InvoiceNumberAllocation> {
    const invoiceYear = referenceDate.getUTCFullYear();
    const repo = manager.getRepository(BillingInvoiceSequence);

    let row = await repo.findOne({ where: { invoiceYear } });
    if (!row) {
      row = repo.create({ invoiceYear, lastNumber: 0 });
    }

    const sequenceNumber = row.lastNumber + 1;
    row.lastNumber = sequenceNumber;
    await repo.save(row);

    return {
      invoiceYear,
      sequenceNumber,
      displayNumber: this.formatDisplayNumber(invoiceYear, sequenceNumber),
    };
  }
}
