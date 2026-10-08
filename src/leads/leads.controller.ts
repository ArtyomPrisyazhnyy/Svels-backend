import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateLeadDto, LeadResponseDto } from './dto/lead.dto';
import { LeadsService } from './leads.service';

/**
 * Публичный эндпоинт приёма заявок с лендинга.
 * Жёсткий rate-limit — защита от спама формы обратной связи.
 */
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@Body() dto: CreateLeadDto): Promise<LeadResponseDto> {
    return this.leadsService.create(dto);
  }
}
