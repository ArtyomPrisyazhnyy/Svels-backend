import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { LandingLead } from './entities/landing-lead.entity';
import { LeadTelegramNotifierService } from './lead-telegram-notifier.service';
import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  const savedLead: LandingLead = {
    id: '019ef5f4-49d3-757f-9a8a-f9458e52fd65',
    name: 'Иван',
    phone: '+375290000000',
    contactTelegram: true,
    contactWhatsapp: false,
    contactViber: false,
    note: null,
    source: 'landing',
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
  };

  let leadRepository: jest.Mocked<
    Pick<Repository<LandingLead>, 'create' | 'save'>
  >;
  let leadTelegramNotifier: jest.Mocked<
    Pick<LeadTelegramNotifierService, 'notifyLead'>
  >;
  let service: LeadsService;

  beforeEach(() => {
    leadRepository = {
      create: jest.fn((payload) => payload as LandingLead),
      save: jest.fn(async (payload) => ({ ...savedLead, ...payload })),
    };
    leadTelegramNotifier = {
      notifyLead: jest.fn(async () => true),
    };
    service = new LeadsService(
      leadRepository as Repository<LandingLead>,
      leadTelegramNotifier as LeadTelegramNotifierService,
    );
  });

  it('rejects lead without contact channel', async () => {
    await expect(
      service.create({
        name: 'Иван',
        phone: '+375290000000',
        contactTelegram: false,
        contactWhatsapp: false,
        contactViber: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails when telegram notification is not delivered', async () => {
    leadTelegramNotifier.notifyLead.mockResolvedValue(false);

    await expect(
      service.create({
        name: 'Иван',
        phone: '+375290000000',
        contactTelegram: true,
        contactWhatsapp: false,
        contactViber: false,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('saves lead and sends telegram notification', async () => {
    const result = await service.create({
      name: 'Иван',
      phone: '+375290000000',
      contactTelegram: true,
      contactWhatsapp: false,
      contactViber: false,
    });

    expect(result).toEqual({ id: savedLead.id });
    expect(leadRepository.save).toHaveBeenCalled();
    expect(leadTelegramNotifier.notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Иван',
        phone: '+375290000000',
        contactTelegram: true,
      }),
    );
  });
});
