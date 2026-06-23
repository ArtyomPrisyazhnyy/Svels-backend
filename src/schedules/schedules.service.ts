import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { WorkSchedule } from './entities/work-schedule.entity';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(WorkSchedule)
    private readonly scheduleRepository: Repository<WorkSchedule>,
    private readonly cacheService: CacheService,
  ) {}

  async getByRestaurant(restaurantId: string): Promise<WorkSchedule[]> {
    const cacheKey = CacheKeys.schedules(restaurantId);
    const cached = await this.cacheService.get<WorkSchedule[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const schedules = await this.scheduleRepository.find({
      where: { restaurantId },
      order: { dayOfWeek: 'ASC' },
    });

    await this.cacheService.set(cacheKey, schedules);
    return schedules;
  }

  async create(restaurantId: string, dto: CreateScheduleDto): Promise<WorkSchedule> {
    const schedule = this.scheduleRepository.create({
      restaurantId,
      dayOfWeek: dto.dayOfWeek,
      openTime: dto.openTime,
      closeTime: dto.closeTime,
      isOpen: dto.isOpen ?? true,
    });

    const saved = await this.scheduleRepository.save(schedule);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async update(
    restaurantId: string,
    scheduleId: string,
    dto: UpdateScheduleDto,
  ): Promise<WorkSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, restaurantId },
    });

    if (!schedule) {
      throw new NotFoundException('Расписание не найдено');
    }

    if (dto.openTime) schedule.openTime = dto.openTime;
    if (dto.closeTime) schedule.closeTime = dto.closeTime;
    if (dto.isOpen !== undefined) schedule.isOpen = dto.isOpen;

    const saved = await this.scheduleRepository.save(schedule);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  private async invalidateCache(restaurantId: string): Promise<void> {
    await this.cacheService.del(CacheKeys.schedules(restaurantId));
  }
}
