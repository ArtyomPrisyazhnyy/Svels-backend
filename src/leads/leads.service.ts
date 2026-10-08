import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sanitizeText } from '../common/utils/sanitize.util';
import { CreateLeadDto, LeadResponseDto } from './dto/lead.dto';
import { LandingLead } from './entities/landing-lead.entity';
import { LeadTelegramNotifierService } from './lead-telegram-notifier.service';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(LandingLead)
    private readonly leadRepository: Repository<LandingLead>,
    private readonly leadTelegramNotifier: LeadTelegramNotifierService,
  ) {}

  async create(dto: CreateLeadDto): Promise<LeadResponseDto> {
    if (!dto.contactTelegram && !dto.contactWhatsapp && !dto.contactViber) {
      throw new BadRequestException('Выберите хотя бы один способ связи');
    }

    const lead = this.leadRepository.create({
      name: sanitizeText(dto.name),
      phone: dto.phone.trim(),
      contactTelegram: dto.contactTelegram,
      contactWhatsapp: dto.contactWhatsapp,
      contactViber: dto.contactViber,
      note: dto.note ? sanitizeText(dto.note) : null,
      source: 'landing',
    });

    const saved = await this.leadRepository.save(lead);
    const delivered = await this.leadTelegramNotifier.notifyLead(saved);
    if (!delivered) {
      throw new ServiceUnavailableException(
        'Не удалось отправить заявку. Попробуйте позже или свяжитесь с нами напрямую.',
      );
    }
    return { id: saved.id };
  }
}
