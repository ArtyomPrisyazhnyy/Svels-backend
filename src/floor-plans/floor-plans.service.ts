import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { sanitizeText } from '../common/utils/sanitize.util';
import { CreateFloorPlanDto, CreateTableDto, UpdateTableDto } from './dto/floor-plan.dto';
import { FloorPlan } from './entities/floor-plan.entity';
import { Table } from './entities/table.entity';

export interface FloorPlanWithTables {
  floorPlans: Array<FloorPlan & { tables: Table[] }>;
}

@Injectable()
export class FloorPlansService {
  constructor(
    @InjectRepository(FloorPlan)
    private readonly floorPlanRepository: Repository<FloorPlan>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    private readonly cacheService: CacheService,
  ) {}

  async getByRestaurant(restaurantId: string): Promise<FloorPlanWithTables> {
    const cacheKey = CacheKeys.floorPlan(restaurantId);
    const cached = await this.cacheService.get<FloorPlanWithTables>(cacheKey);
    if (cached) {
      return cached;
    }

    const floorPlans = await this.floorPlanRepository.find({
      where: { restaurantId },
    });

    const tables = await this.tableRepository.find({
      where: { restaurantId },
    });

    const result: FloorPlanWithTables = {
      floorPlans: floorPlans.map((plan) => ({
        ...plan,
        tables: tables.filter((table) => table.floorPlanId === plan.id),
      })),
    };

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async createFloorPlan(
    restaurantId: string,
    dto: CreateFloorPlanDto,
  ): Promise<FloorPlan> {
    const plan = this.floorPlanRepository.create({
      restaurantId,
      name: sanitizeText(dto.name),
      layoutData: dto.layoutData ?? null,
    });

    const saved = await this.floorPlanRepository.save(plan);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async createTable(
    restaurantId: string,
    floorPlanId: string,
    dto: CreateTableDto,
  ): Promise<Table> {
    const table = this.tableRepository.create({
      restaurantId,
      floorPlanId,
      label: sanitizeText(dto.label),
      capacity: dto.capacity,
      positionX: dto.positionX ?? null,
      positionY: dto.positionY ?? null,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.tableRepository.save(table);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async updateTable(
    restaurantId: string,
    tableId: string,
    dto: UpdateTableDto,
  ): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id: tableId, restaurantId },
    });

    if (!table) {
      throw new NotFoundException('Стол не найден');
    }

    if (dto.label) table.label = sanitizeText(dto.label);
    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    if (dto.positionX !== undefined) table.positionX = dto.positionX;
    if (dto.positionY !== undefined) table.positionY = dto.positionY;
    if (dto.isActive !== undefined) table.isActive = dto.isActive;

    const saved = await this.tableRepository.save(table);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async findTableById(tableId: string): Promise<Table | null> {
    return this.tableRepository.findOne({ where: { id: tableId } });
  }

  private async invalidateCache(restaurantId: string): Promise<void> {
    await this.cacheService.del(CacheKeys.floorPlan(restaurantId));
  }
}
