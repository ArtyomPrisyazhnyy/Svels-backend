import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('billing_invoice_sequences')
export class BillingInvoiceSequence {
  @PrimaryColumn({ type: 'int' })
  invoiceYear: number;

  @Column({ type: 'int', default: 0 })
  lastNumber: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
