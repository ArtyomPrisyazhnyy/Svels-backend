import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingSettingsModule } from '../booking-settings/booking-settings.module';
import { FLOOR_PLANS_SERVICE } from '../common/constants/injection-tokens';
import { FloorPlan } from './entities/floor-plan.entity';
import { Table } from './entities/table.entity';
import { FloorPlansController } from './floor-plans.controller';
import { FloorPlansService } from './floor-plans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FloorPlan, Table]),
    BookingSettingsModule,
  ],
  controllers: [FloorPlansController],
  providers: [
    FloorPlansService,
    { provide: FLOOR_PLANS_SERVICE, useExisting: FloorPlansService },
  ],
  exports: [FLOOR_PLANS_SERVICE],
})
export class FloorPlansModule {}
