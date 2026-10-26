import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { generateUuidV7 } from '../common/utils/uuid.util';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { addMonths } from './billing-status-machine';
import { BillingInvoiceNumberingService } from './billing-invoice-numbering.service';
import { BillingPdfService } from './billing-pdf.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { InvoiceStatus } from './enums/invoice-status.enum';
import { BillingInvoice } from './entities/billing-invoice.entity';

export interface InvoiceListItem {
  id: string;
  restaurantId: string;
  displayNumber: string;
  amountByn: string;
  periodStart: Date;
  periodEnd: Date;
  status: InvoiceStatus;
  createdAt: Date;
}

@Injectable()
export class BillingInvoiceService {
  constructor(
    @InjectRepository(BillingInvoice)
    private readonly invoiceRepository: Repository<BillingInvoice>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    private readonly dataSource: DataSource,
    private readonly numberingService: BillingInvoiceNumberingService,
    private readonly pdfService: BillingPdfService,
    private readonly subscriptionService: BillingSubscriptionService,
  ) {}

  async listForRestaurant(restaurantId: string): Promise<InvoiceListItem[]> {
    const invoices = await this.invoiceRepository.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
    return invoices.map((invoice) => this.toListItem(invoice));
  }

  async createInvoice(
    restaurantId: string,
    periodStart?: Date,
  ): Promise<InvoiceListItem> {
    const subscription =
      await this.subscriptionService.getByRestaurantIdOrThrow(restaurantId);
    const plan = subscription.plan;
    if (!plan) {
      throw new BadRequestException('У подписки не задан тариф');
    }

    const start = periodStart ?? new Date();
    const end = addMonths(start, 1);
    const amountByn = plan.priceMonthlyByn;

    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const allocation = await this.numberingService.allocateNextNumber(
        manager,
        start,
      );

      const invoice = manager.getRepository(BillingInvoice).create({
        id: generateUuidV7(),
        restaurantId,
        invoiceYear: allocation.invoiceYear,
        sequenceNumber: allocation.sequenceNumber,
        amountByn,
        periodStart: start,
        periodEnd: end,
        status: InvoiceStatus.ISSUED,
        pdfData: null,
      });

      const pdf = await this.pdfService.generateInvoicePdf({
        invoice,
        plan,
        restaurantName: restaurant.name,
        restaurantUnp: restaurant.unp,
      });
      invoice.pdfData = pdf;

      return manager.getRepository(BillingInvoice).save(invoice);
    });

    return this.toListItem(saved);
  }

  async voidInvoice(invoiceId: string): Promise<InvoiceListItem> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException('Счёт не найден');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Оплаченный счёт нельзя аннулировать');
    }
    invoice.status = InvoiceStatus.VOID;
    const saved = await this.invoiceRepository.save(invoice);
    return this.toListItem(saved);
  }

  async markInvoicePaid(invoiceId: string): Promise<{
    invoice: InvoiceListItem;
    subscriptionRestaurantId: string;
  }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException('Счёт не найден');
    }
    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Счёт аннулирован');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      return {
        invoice: this.toListItem(invoice),
        subscriptionRestaurantId: invoice.restaurantId,
      };
    }

    invoice.status = InvoiceStatus.PAID;
    await this.invoiceRepository.save(invoice);
    await this.subscriptionService.markPaid(invoice.restaurantId);

    return {
      invoice: this.toListItem(invoice),
      subscriptionRestaurantId: invoice.restaurantId,
    };
  }

  async getInvoicePdf(
    invoiceId: string,
    restaurantId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, restaurantId },
    });
    if (!invoice) {
      throw new NotFoundException('Счёт не найден');
    }
    if (!invoice.pdfData) {
      throw new NotFoundException('PDF для счёта не сгенерирован');
    }

    const displayNumber = this.numberingService.formatDisplayNumber(
      invoice.invoiceYear,
      invoice.sequenceNumber,
    );

    return {
      buffer: invoice.pdfData,
      filename: `invoice-${displayNumber}.pdf`,
    };
  }

  private toListItem(invoice: BillingInvoice): InvoiceListItem {
    return {
      id: invoice.id,
      restaurantId: invoice.restaurantId,
      displayNumber: this.numberingService.formatDisplayNumber(
        invoice.invoiceYear,
        invoice.sequenceNumber,
      ),
      amountByn: invoice.amountByn,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      status: invoice.status,
      createdAt: invoice.createdAt,
    };
  }
}
