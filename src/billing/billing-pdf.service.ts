import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';
import { BillingInvoiceNumberingService } from './billing-invoice-numbering.service';
import type { BillingInvoice } from './entities/billing-invoice.entity';
import type { BillingPlan } from './entities/billing-plan.entity';

export interface InvoicePdfContext {
  invoice: BillingInvoice;
  plan: BillingPlan;
  restaurantName: string;
  restaurantUnp: string | null;
}

@Injectable()
export class BillingPdfService {
  private readonly fontPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly numberingService: BillingInvoiceNumberingService,
  ) {
    this.fontPath = path.join(
      path.dirname(require.resolve('dejavu-fonts-ttf/package.json')),
      'ttf',
      'DejaVuSans.ttf',
    );
  }

  async generateInvoicePdf(context: InvoicePdfContext): Promise<Buffer> {
    const payee = this.configService.get<{
      name: string;
      unp: string;
      bankName: string;
      bik: string;
      account: string;
      phone: string;
      address: string;
    }>('billing.payee');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.font(this.fontPath);

    const number = this.numberingService.formatDisplayNumber(
      context.invoice.invoiceYear,
      context.invoice.sequenceNumber,
    );

    doc.fontSize(16).text('Счёт на оплату', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`№ ${number} от ${this.formatDate(context.invoice.createdAt)}`);
    doc.moveDown();

    doc.text('Получатель платежа:');
    doc.text(payee?.name ?? '');
    doc.text(`УНП: ${payee?.unp ?? ''}`);
    doc.text(`Банк: ${payee?.bankName ?? ''}`);
    doc.text(`БИК: ${payee?.bik ?? ''}`);
    doc.text(`Р/с: ${payee?.account ?? ''}`);
    doc.text(`Адрес: ${payee?.address ?? ''}`);
    doc.text(`Тел.: ${payee?.phone ?? ''}`);
    doc.moveDown();

    doc.text('Плательщик:');
    doc.text(context.restaurantName);
    if (context.restaurantUnp) {
      doc.text(`УНП: ${context.restaurantUnp}`);
    }
    doc.moveDown();

    doc.text(
      `Период подписки: ${this.formatDate(context.invoice.periodStart)} — ${this.formatDate(context.invoice.periodEnd)}`,
    );
    doc.text(`Тариф: ${context.plan.name}`);
    doc.moveDown();

    doc.text(
      `Сумма к оплате: ${this.formatAmount(context.invoice.amountByn)} BYN`,
      { underline: true },
    );
    doc.moveDown();

    doc.fontSize(10).text(
      'Оплата банковским переводом по реквизитам выше. Укажите номер счёта в назначении платежа.',
    );

    doc.end();
    return finished;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private formatAmount(amount: string): string {
    const numeric = Number(amount);
    return numeric.toFixed(2);
  }
}
