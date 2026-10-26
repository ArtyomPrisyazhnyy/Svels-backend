import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InvoiceStatus } from '../enums/invoice-status.enum';

@Entity('billing_invoices')
@Index('IDX_billing_invoices_restaurant', ['restaurantId'])
@Index('UQ_billing_invoices_year_number', ['invoiceYear', 'sequenceNumber'], {
  unique: true,
})
export class BillingInvoice {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'int' })
  invoiceYear: number;

  @Column({ type: 'int' })
  sequenceNumber: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountByn: string;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'timestamptz' })
  periodEnd: Date;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.ISSUED })
  status: InvoiceStatus;

  @Column({ type: 'bytea', nullable: true })
  pdfData: Buffer | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
