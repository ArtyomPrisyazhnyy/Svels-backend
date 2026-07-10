import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BOOKING_SETTINGS_SERVICE } from '../common/constants/injection-tokens';
import { DepositScheme } from '../common/enums/deposit-scheme.enum';
import { TableObjectType } from '../common/enums/table-object-type.enum';
import { TableShape } from '../common/enums/table-shape.enum';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { sanitizeText } from '../common/utils/sanitize.util';
import type { BookingSettingsSnapshot, BookingSettingsService } from '../booking-settings/booking-settings.service';
import type { DecorLayoutData } from './entities/decor-layout-data.type';
import {
  CreateFloorPlanDto,
  CreateTableDto,
  SaveLayoutDto,
  UpdateFloorPlanDto,
  UpdateTableDto,
} from './dto/floor-plan.dto';
import { FloorPlan } from './entities/floor-plan.entity';
import { Table } from './entities/table.entity';
import type { TableSeat } from './entities/table-seat.type';

export interface FloorPlanZone {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  depositAmount: number;
  decorData: DecorLayoutData | null;
  tables: Table[];
  createdAt: string;
  updatedAt: string;
}

export interface FloorPlanLayoutResponse {
  zones: FloorPlanZone[];
}

export interface PublicFloorPlanTable {
  id: string;
  floorPlanId: string;
  label: string;
  objectType: TableObjectType;
  capacity: number;
  minCapacity: number;
  positionX: number | null;
  positionY: number | null;
  width: number;
  height: number;
  rotation: number;
  shape: TableShape;
  points: number[] | null;
  seats: TableSeat[] | null;
  cornerRadius: number;
  depositAmount: number;
  description: string | null;
}

export interface PublicFloorPlanZone {
  id: string;
  name: string;
  sortOrder: number;
  depositAmount: number;
  decorData: DecorLayoutData | null;
  tables: PublicFloorPlanTable[];
}

export interface PublicFloorPlanLayoutResponse {
  depositScheme: DepositScheme;
  globalDepositAmount: number;
  bookingDurationMinutes: number;
  zones: PublicFloorPlanZone[];
}

@Injectable()
export class FloorPlansService {
  constructor(
    @InjectRepository(FloorPlan)
    private readonly floorPlanRepository: Repository<FloorPlan>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    private readonly cacheService: CacheService,
    @Inject(BOOKING_SETTINGS_SERVICE)
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly dataSource: DataSource,
  ) {}

  // ───────────────────────────── Admin layout ─────────────────────────────

  /** Полная планировка зон/столов/decor для админа (включая невидимые гостям столы). */
  async getLayout(restaurantId: string): Promise<FloorPlanLayoutResponse> {
    const cacheKey = CacheKeys.floorPlan(restaurantId);
    const cached = await this.cacheService.get<FloorPlanLayoutResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.loadLayoutFromDb(restaurantId);
    await this.cacheService.set(cacheKey, result);
    return result;
  }

  private async loadLayoutFromDb(restaurantId: string): Promise<FloorPlanLayoutResponse> {
    const floorPlans = await this.floorPlanRepository.find({
      where: { restaurantId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const tables = await this.tableRepository.find({
      where: { restaurantId },
      order: { label: 'ASC' },
    });

    return {
      zones: floorPlans.map((plan) => ({
        id: plan.id,
        restaurantId: plan.restaurantId,
        name: plan.name,
        sortOrder: plan.sortOrder,
        depositAmount: Number(plan.depositAmount),
        decorData: plan.decorData,
        tables: tables
          .filter((table) => table.floorPlanId === plan.id)
          .map((table) => this.normalizeTable(table)),
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      })),
    };
  }

  // ──────────────────────────── Public layout ─────────────────────────────

  /** Публичная планировка для гостя (только visibleToGuests + isActive столы). */
  async getPublicLayout(restaurantId: string): Promise<PublicFloorPlanLayoutResponse> {
    const cacheKey = CacheKeys.publicLayout(restaurantId);
    const cached = await this.cacheService.get<PublicFloorPlanLayoutResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const settings = await this.bookingSettingsService.getSnapshot(restaurantId);
    const layout = await this.loadLayoutFromDb(restaurantId);

    const zones: PublicFloorPlanZone[] = layout.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      sortOrder: zone.sortOrder,
      depositAmount: zone.depositAmount,
      decorData: zone.decorData,
      tables: zone.tables
        .filter((table) => table.isActive && table.visibleToGuests)
        .map((table) => this.toPublicTable(table)),
    }));

    const result: PublicFloorPlanLayoutResponse = {
      depositScheme: settings.depositScheme,
      globalDepositAmount: Number(settings.depositAmount),
      bookingDurationMinutes: settings.bookingDurationMinutes,
      zones,
    };
    await this.cacheService.set(cacheKey, result);
    return result;
  }

  // ──────────────────────────── Zone CRUD ─────────────────────────────────

  async createFloorPlan(
    restaurantId: string,
    dto: CreateFloorPlanDto,
  ): Promise<FloorPlan> {
    const sortOrder =
      dto.sortOrder ??
      (await this.floorPlanRepository.count({ where: { restaurantId } }));
    const plan = this.floorPlanRepository.create({
      restaurantId,
      name: sanitizeText(dto.name),
      sortOrder,
      depositAmount: dto.depositAmount ?? 0,
      decorData: dto.decorData ?? null,
    });

    const saved = await this.floorPlanRepository.save(plan);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async updateFloorPlan(
    restaurantId: string,
    floorPlanId: string,
    dto: UpdateFloorPlanDto,
  ): Promise<FloorPlan> {
    const plan = await this.findFloorPlanOrFail(restaurantId, floorPlanId);

    if (dto.name !== undefined) plan.name = sanitizeText(dto.name);
    if (dto.sortOrder !== undefined) plan.sortOrder = dto.sortOrder;
    if (dto.depositAmount !== undefined) plan.depositAmount = dto.depositAmount;
    if (dto.decorData !== undefined) plan.decorData = dto.decorData;

    const saved = await this.floorPlanRepository.save(plan);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async deleteFloorPlan(restaurantId: string, floorPlanId: string): Promise<void> {
    const plan = await this.findFloorPlanOrFail(restaurantId, floorPlanId);

    const hasTables = await this.tableRepository.exists({
      where: { floorPlanId },
    });
    if (hasTables) {
      throw new BadRequestException(
        'Нельзя удалить зал: в нём есть столы. Сначала удалите или переместите столы.',
      );
    }

    await this.floorPlanRepository.remove(plan);
    await this.invalidateCache(restaurantId);
  }

  // ──────────────────────── Atomic bulk save layout ───────────────────────

  /**
   * Atomic bulk-сохранение всей планировки зоны одним запросом:
   *   - обновляет `floor_plans.decorData`;
   *   - upsert'ит столы зоны (по id из DTO);
   *   - удаляет столы зоны, отсутствующие в DTO (но не те, у кого есть активные брони).
   * Всё в одной транзакции. После коммита — атомарная инвалидация кэша через pipeline.
   */
  async saveLayout(
    restaurantId: string,
    floorPlanId: string,
    dto: SaveLayoutDto,
  ): Promise<FloorPlanZone> {
    const plan = await this.findFloorPlanOrFail(restaurantId, floorPlanId);

    const savedZone = await this.dataSource.transaction(async (manager) => {
      const floorPlanRepo = manager.getRepository(FloorPlan);
      const tableRepo = manager.getRepository(Table);

      // 1. decorData зоны
      plan.decorData = dto.decorData ?? plan.decorData;
      await floorPlanRepo.save(plan);

      // 2. Существующие столы зоны
      const existingTables = await tableRepo.find({ where: { floorPlanId } });
      const existingById = new Map(existingTables.map((t) => [t.id, t]));
      const dtoIds = new Set(dto.tables.filter((t) => t.id).map((t) => t.id as string));

      // 3. Удаление отсутствующих столов (если нет активных броней)
      const toRemove = existingTables.filter((t) => !dtoIds.has(t.id));
      if (toRemove.length > 0) {
        const removeIds = toRemove.map((t) => t.id);
        const activeBookingsCount = await manager
          .getRepository('Booking')
          .count({ where: { tableId: In(removeIds) } });
        if (activeBookingsCount > 0) {
          throw new BadRequestException(
            'Нельзя удалить столы с существующими бронированиями. Сначала отмените брони.',
          );
        }
        await tableRepo.delete(removeIds);
      }

      // 4. Upsert столов из DTO
      for (const tableDto of dto.tables) {
        const target = tableDto.id
          ? existingById.get(tableDto.id) ?? tableRepo.create({ id: tableDto.id })
          : tableRepo.create();

        target.restaurantId = restaurantId;
        target.floorPlanId = floorPlanId;
        target.label = sanitizeText(tableDto.label);
        target.objectType = tableDto.objectType ?? TableObjectType.TABLE;
        target.shape = tableDto.shape ?? TableShape.RECTANGLE;
        target.capacity = tableDto.capacity;
        target.minCapacity = tableDto.minCapacity ?? 1;
        target.positionX = tableDto.positionX ?? null;
        target.positionY = tableDto.positionY ?? null;
        target.width = tableDto.width ?? 90;
        target.height = tableDto.height ?? 90;
        target.points = tableDto.points ?? null;
        target.seats = tableDto.seats ?? null;
        target.cornerRadius = tableDto.cornerRadius ?? 6;
        target.rotation = tableDto.rotation ?? 0;
        target.depositAmount = tableDto.depositAmount ?? 0;
        target.isActive = tableDto.isActive ?? true;
        target.visibleToGuests = tableDto.visibleToGuests ?? true;
        target.description = tableDto.description ? sanitizeText(tableDto.description) : null;

        await tableRepo.save(target);
      }

      // 5. Перечитать зону с актуальными столами
      const tables = await tableRepo.find({
        where: { floorPlanId },
        order: { label: 'ASC' },
      });

      return this.toZone(plan, tables);
    });

    await this.invalidateCache(restaurantId);
    return savedZone;
  }

  // ──────────────────────────── Table CRUD ────────────────────────────────

  async createTable(
    restaurantId: string,
    floorPlanId: string,
    dto: CreateTableDto,
  ): Promise<Table> {
    await this.findFloorPlanOrFail(restaurantId, floorPlanId);

    const table = this.tableRepository.create({
      restaurantId,
      floorPlanId,
      label: sanitizeText(dto.label),
      objectType: dto.objectType ?? TableObjectType.TABLE,
      shape: dto.shape ?? TableShape.RECTANGLE,
      capacity: dto.capacity,
      minCapacity: dto.minCapacity ?? 1,
      positionX: dto.positionX ?? null,
      positionY: dto.positionY ?? null,
      width: dto.width ?? 90,
      height: dto.height ?? 90,
      points: dto.points ?? null,
      seats: dto.seats ?? null,
      cornerRadius: dto.cornerRadius ?? 6,
      rotation: dto.rotation ?? 0,
      depositAmount: dto.depositAmount ?? 0,
      isActive: dto.isActive ?? true,
      visibleToGuests: dto.visibleToGuests ?? true,
      description: dto.description ? sanitizeText(dto.description) : null,
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

    if (dto.label !== undefined) table.label = sanitizeText(dto.label);
    if (dto.objectType !== undefined) table.objectType = dto.objectType;
    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    if (dto.minCapacity !== undefined) table.minCapacity = dto.minCapacity;
    if (dto.positionX !== undefined) table.positionX = dto.positionX;
    if (dto.positionY !== undefined) table.positionY = dto.positionY;
    if (dto.width !== undefined) table.width = dto.width;
    if (dto.height !== undefined) table.height = dto.height;
    if (dto.points !== undefined) table.points = dto.points;
    if (dto.seats !== undefined) table.seats = dto.seats;
    if (dto.cornerRadius !== undefined) table.cornerRadius = dto.cornerRadius;
    if (dto.rotation !== undefined) table.rotation = dto.rotation;
    if (dto.shape !== undefined) table.shape = dto.shape;
    if (dto.depositAmount !== undefined) table.depositAmount = dto.depositAmount;
    if (dto.isActive !== undefined) table.isActive = dto.isActive;
    if (dto.visibleToGuests !== undefined) table.visibleToGuests = dto.visibleToGuests;
    if (dto.description !== undefined) {
      table.description = dto.description ? sanitizeText(dto.description) : null;
    }

    const saved = await this.tableRepository.save(table);
    await this.invalidateCache(restaurantId);
    return saved;
  }

  async deleteTable(restaurantId: string, tableId: string): Promise<void> {
    const table = await this.tableRepository.findOne({
      where: { id: tableId, restaurantId },
    });
    if (!table) {
      throw new NotFoundException('Стол не найден');
    }

    const activeBookingsCount = await this.dataSource
      .getRepository('Booking')
      .count({ where: { tableId } });
    if (activeBookingsCount > 0) {
      throw new BadRequestException(
        'Нельзя удалить стол с существующими бронированиями. Сначала отмените брони.',
      );
    }

    await this.tableRepository.remove(table);
    await this.invalidateCache(restaurantId);
  }

  // ──────────────────────────── Cross-module ──────────────────────────────

  async findTableById(tableId: string): Promise<Table | null> {
    return this.tableRepository.findOne({ where: { id: tableId } });
  }

  /** Все активные столы ресторана (для бронирования / доступности). */
  async getActiveTables(restaurantId: string): Promise<Table[]> {
    return this.tableRepository.find({
      where: { restaurantId, isActive: true },
      order: { label: 'ASC' },
    });
  }

  /** Зона со столами — для разрешения депозита PER_ZONE в BookingsService. */
  async findFloorPlanById(
    restaurantId: string,
    floorPlanId: string,
  ): Promise<FloorPlan | null> {
    return this.floorPlanRepository.findOne({ where: { id: floorPlanId, restaurantId } });
  }

  // ────────────────────────────── Helpers ─────────────────────────────────

  private async findFloorPlanOrFail(
    restaurantId: string,
    floorPlanId: string,
  ): Promise<FloorPlan> {
    const plan = await this.floorPlanRepository.findOne({
      where: { id: floorPlanId, restaurantId },
    });
    if (!plan) {
      throw new NotFoundException('Зал не найден');
    }
    return plan;
  }

  private normalizeTable(table: Table): Table {
    return {
      ...table,
      depositAmount: Number(table.depositAmount),
    };
  }

  private toPublicTable(table: Table): PublicFloorPlanTable {
    return {
      id: table.id,
      floorPlanId: table.floorPlanId,
      label: table.label,
      objectType: table.objectType,
      capacity: table.capacity,
      minCapacity: table.minCapacity,
      positionX: table.positionX,
      positionY: table.positionY,
      width: table.width,
      height: table.height,
      rotation: table.rotation,
      shape: table.shape,
      points: table.points ?? null,
      seats: table.seats ?? null,
      cornerRadius: table.cornerRadius,
      depositAmount: Number(table.depositAmount),
      description: table.description,
    };
  }

  private toZone(plan: FloorPlan, tables: Table[]): FloorPlanZone {
    return {
      id: plan.id,
      restaurantId: plan.restaurantId,
      name: plan.name,
      sortOrder: plan.sortOrder,
      depositAmount: Number(plan.depositAmount),
      decorData: plan.decorData,
      tables: tables.map((t) => this.normalizeTable(t)),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  /**
   * Атомарная инвалидация всех связанных кэшей (правило data-transactions:
   * multi-key операция одним pipeline-батчем). Затрагивает floor-plan, public-layout
   * и availability на все даты (через pattern-удаление).
   */
  private async invalidateCache(restaurantId: string): Promise<void> {
    const keys = [
      CacheKeys.floorPlan(restaurantId),
      CacheKeys.publicLayout(restaurantId),
    ];
    await Promise.all([
      this.cacheService.delMany(keys),
      this.cacheService.delByPattern(
        `restaurant:${restaurantId}:availability:*`,
      ),
    ]);
  }
}
