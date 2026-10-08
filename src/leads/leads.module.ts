import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingLead } from './entities/landing-lead.entity';
import { LeadTelegramNotifierService } from './lead-telegram-notifier.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [TypeOrmModule.forFeature([LandingLead])],
  controllers: [LeadsController],
  providers: [LeadsService, LeadTelegramNotifierService],
  exports: [LeadsService],
})
export class LeadsModule {}
