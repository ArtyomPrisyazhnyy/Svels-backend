import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BOOKING_SETTINGS_SERVICE, FLOOR_PLANS_SERVICE } from '../common/constants/injection-tokens';
import { BookingMode } from '../common/enums/booking-mode.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { DepositScheme } from '../common/enums/deposit-scheme.enum';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { sanitizeText } from '../common/utils/sanitize.util';
import { FloorPlansService } from '../floor-plans/floor-plans.service';
import type { BookingSettingsSnapshot, BookingSettingsService } from '../booking-settings/booking-settings.service';
import { SchedulesService } from '../schedules/schedules.service';
import { WorkSchedule } from '../schedules/entities/work-schedule.entity';
import { RestaurantBookingSettings } from '../booking-settings/entities/restaurant-booking-settings.entity';
import { CreateBookingDto, UpdateBookingStatusDto } from './dto/booking.dto';
import { Booking } from './entities/booking.entity';
import type { Table } from '../floor-plans/entities/table.entity';
import type { FloorPlan } from '../floor-plans/entities/floor-plan.entity';

const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

/** TTL Redis-лока на слот брони — достаточно для завершения транзакции БД. */
const BOOKING_LOCK_TTL_SECONDS = 10;

export interface TableAvailability {
  id: string;
  label: string;
  capacity: number;
  occupiedSlots: string[];
}

export interface SeatsAvailability {
  total: number;
  occupied: number;
  remaining: number;
}

export interface BookingAvailabilityResponse {
  enabled: boolean;
  mode: BookingMode;
  slotMinutes: number;
  bookingDurationMinutes: number;
  date: string;
  slots: string[];
  tables?: TableAvailability[];
  seatsBySlot?: Record<string, SeatsAvailability>;
}

export interface TableBusyEntry {
  tableId: string;
  busyUntil: string; // ISO
}

export interface TablesAvailabilityResponse {
  date: string;
  time: string;
  durationMinutes: number;
  busy: TableBusyEntry[];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxDateString(advanceDays: number): string {
  return new Date(Date.now() + advanceDays * 86_400_000).toISOString().slice(0, 10);
}

function dayOfWeekOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function currentMinutesLocal(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Нормализация slotStart/slotEnd из date+time (интерпретируем как локальное время сервера). */
function buildSlotRange(date: string, time: string, durationMinutes: number): { start: Date; end: Date } {
  const start = new Date(`${date}T${time.slice(0, 5)}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @Inject(FLOOR_PLANS_SERVICE)
    private readonly floorPlansService: FloorPlansService,
    @Inject(BOOKING_SETTINGS_SERVICE)
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly schedulesService: SchedulesService,
    private readonly cacheService: CacheService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    restaurantId: string,
    userId: string,
    dto: CreateBookingDto,
  ): Promise<Booking> {
    const settings = await this.bookingSettingsService.getSnapshot(restaurantId);

    if (!settings.bookingEnabled) {
      throw new BadRequestException('Бронирование в этом заведении недоступно');
    }

    if (dto.guestCount > settings.maxGuests) {
      throw new BadRequestException(
        `Максимум гостей на бронирование — ${settings.maxGuests}`,
      );
    }

    if (dto.bookingDate < todayString() || dto.bookingDate > maxDateString(settings.advanceDays)) {
      throw new BadRequestException(
        `Бронирование доступно на срок до ${settings.advanceDays} дней вперёд`,
      );
    }

    if (settings.mode === BookingMode.SPECIFIC_TABLE) {
      return this.createSpecificTable(restaurantId, userId, dto, settings);
    }

    return this.createBySeats(restaurantId, userId, dto, settings);
  }

  // ─────────────────── SPECIFIC_TABLE: Redis lock + SERIALIZABLE ───────────

  private async createSpecificTable(
    restaurantId: string,
    userId: string,
    dto: CreateBookingDto,
    settings: BookingSettingsSnapshot,
  ): Promise<Booking> {
    if (!dto.tableId) {
      throw new BadRequestException('Выберите стол');
    }

    const table = await this.floorPlansService.findTableById(dto.tableId);
    if (!table || table.restaurantId !== restaurantId) {
      throw new NotFoundException('Стол не найден');
    }
    if (!table.isActive) {
      throw new BadRequestException('Стол недоступен для бронирования');
    }
    if (dto.guestCount > table.capacity) {
      throw new BadRequestException(
        `Количество гостей превышает вместимость стола (${table.capacity})`,
      );
    }
    if (dto.guestCount < table.minCapacity) {
      throw new BadRequestException(
        `Минимальное количество гостей для этого стола — ${table.minCapacity}`,
      );
    }

    const { start: slotStart, end: slotEnd } = buildSlotRange(
      dto.bookingDate,
      dto.bookingTime,
      settings.bookingDurationMinutes,
    );
    const lockKey = CacheKeys.bookingTableLock(dto.tableId, slotStart.toISOString());

    // 1. Redis-лок: fast-fail второму параллельному запросу.
    const lockToken = await this.cacheService.tryLock(lockKey, BOOKING_LOCK_TTL_SECONDS);
    if (lockToken === null) {
      throw new ConflictException('Стол уже бронируется — попробуйте ещё раз');
    }

    try {
      // 2. Разрешение депозита (снимок на момент брони).
      const depositAmount = await this.resolveDeposit(settings, table);

      // 3. SERIALIZABLE транзакция + FOR UPDATE на строку стола.
      //    EXCLUDE gist-индекс (миграция) — финальный guard на уровне БД.
      return await this.dataSource.transaction(
        'SERIALIZABLE',
        async (manager) => {
          // Пессимистическая блокировка строки стола — сериализует транзакции по одному столу.
          await manager
            .getRepository('Table')
            .createQueryBuilder('table')
            .setLock('pessimistic_write')
            .where('table.id = :id', { id: dto.tableId })
            .getOne();

          // Проверка пересечения slot-окна с активными бронями этого стола.
          const overlapping = await manager
            .createQueryBuilder(Booking, 'booking')
            .where('booking.tableId = :tableId', { tableId: dto.tableId })
            .andWhere('booking.status IN (:...statuses)', { statuses: ACTIVE_BOOKING_STATUSES })
            .andWhere('booking.slotStart < :end', { end: slotEnd })
            .andWhere('booking.slotEnd > :start', { start: slotStart })
            .getOne();

          if (overlapping) {
            throw new ConflictException('Стол уже забронирован на это время');
          }

          const booking = manager.create(Booking, {
            restaurantId,
            tableId: dto.tableId,
            userId,
            bookingDate: dto.bookingDate,
            bookingTime: dto.bookingTime,
            slotStart,
            slotEnd,
            guestCount: dto.guestCount,
            depositAmount,
            notes: dto.notes ? sanitizeText(dto.notes) : null,
            status: settings.autoConfirm ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
          });

          const saved = await manager.save(booking);
          await this.invalidateAvailabilityCache(restaurantId, dto.bookingDate);
          return saved;
        },
      );
    } finally {
      // Снятие лока с проверкой ownership (не снимаем чужой лок).
      await this.cacheService.unlock(lockKey, lockToken);
    }
  }

  private async createBySeats(
    restaurantId: string,
    userId: string,
    dto: CreateBookingDto,
    settings: BookingSettingsSnapshot,
  ): Promise<Booking> {
    const tables = await this.floorPlansService.getActiveTables(restaurantId);
    const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
    const { start: slotStart, end: slotEnd } = buildSlotRange(
      dto.bookingDate,
      dto.bookingTime,
      settings.bookingDurationMinutes,
    );

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // Сериализуем брони ресторана на слот: блокируем строку настроек бронирования.
      await manager
        .getRepository(RestaurantBookingSettings)
        .createQueryBuilder('settings')
        .setLock('pessimistic_write')
        .where('settings.restaurantId = :restaurantId', { restaurantId })
        .getOne();

      const occupiedRows = await manager
        .createQueryBuilder(Booking, 'booking')
        .where('booking.restaurantId = :restaurantId', { restaurantId })
        .andWhere('booking.bookingDate = :bookingDate', { bookingDate: dto.bookingDate })
        .andWhere('booking.slotStart < :end', { end: slotEnd })
        .andWhere('booking.slotEnd > :start', { start: slotStart })
        .andWhere('booking.status IN (:...statuses)', { statuses: ACTIVE_BOOKING_STATUSES })
        .getMany();

      const occupiedSeats = occupiedRows.reduce((sum, b) => sum + b.guestCount, 0);

      if (totalCapacity > 0 && occupiedSeats + dto.guestCount > totalCapacity) {
        throw new BadRequestException('На это время нет свободных мест');
      }

      const booking = manager.create(Booking, {
        restaurantId,
        tableId: null,
        userId,
        bookingDate: dto.bookingDate,
        bookingTime: dto.bookingTime,
        slotStart,
        slotEnd,
        guestCount: dto.guestCount,
        depositAmount: settings.depositScheme === DepositScheme.GLOBAL_DEPOSIT
          ? Number(settings.depositAmount)
          : 0,
        notes: dto.notes ? sanitizeText(dto.notes) : null,
        status: settings.autoConfirm ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
      });

      const saved = await manager.save(booking);
      await this.invalidateAvailabilityCache(restaurantId, dto.bookingDate);
      return saved;
    });
  }

  /**
   * Разрешение суммы депозита по схеме (для SPECIFIC_TABLE):
   *   NO_DEPOSIT  → 0
   *   GLOBAL      → settings.depositAmount
   *   PER_ZONE    → zone.depositAmount (fallback на global)
   *   PER_TABLE   → table.depositAmount (fallback на zone, затем global)
   */
  private async resolveDeposit(
    settings: BookingSettingsSnapshot,
    table: Table,
  ): Promise<number> {
    if (settings.depositScheme === DepositScheme.NO_DEPOSIT) {
      return 0;
    }
    if (settings.depositScheme === DepositScheme.GLOBAL_DEPOSIT) {
      return Number(settings.depositAmount);
    }

    const zone = await this.floorPlansService.findFloorPlanById(
      table.restaurantId,
      table.floorPlanId,
    );
    const zoneDeposit = zone ? Number(zone.depositAmount) : 0;
    const globalDeposit = Number(settings.depositAmount);

    if (settings.depositScheme === DepositScheme.PER_ZONE) {
      return zoneDeposit || globalDeposit;
    }

    // PER_TABLE
    const tableDeposit = Number(table.depositAmount);
    return tableDeposit || zoneDeposit || globalDeposit;
  }

  // ─────────────────────────── Availability ────────────────────────────────

  async getAvailability(
    restaurantId: string,
    date: string,
  ): Promise<BookingAvailabilityResponse> {
    const settings = await this.bookingSettingsService.getSnapshot(restaurantId);

    const base: BookingAvailabilityResponse = {
      enabled: settings.bookingEnabled,
      mode: settings.mode,
      slotMinutes: settings.slotMinutes,
      bookingDurationMinutes: settings.bookingDurationMinutes,
      date,
      slots: [],
    };

    if (!settings.bookingEnabled) {
      return base;
    }

    if (date < todayString() || date > maxDateString(settings.advanceDays)) {
      return base;
    }

    const schedules = await this.schedulesService.getByRestaurant(restaurantId);
    const dayOfWeek = dayOfWeekOf(date);
    const daySchedules = schedules.filter(
      (s) => s.dayOfWeek === dayOfWeek && s.isOpen,
    );

    const slots = this.generateSlots(daySchedules, settings.slotMinutes, date);
    base.slots = slots;

    const tables = await this.floorPlansService.getActiveTables(restaurantId);
    // Все активные брони на дату (одним запросом), далее фильтруем по overlap в памяти.
    const bookings = await this.bookingRepository.find({
      where: { restaurantId, bookingDate: date },
    });
    const activeBookings = bookings.filter((b) =>
      ACTIVE_BOOKING_STATUSES.includes(b.status),
    );

    if (settings.mode === BookingMode.SPECIFIC_TABLE) {
      base.tables = tables.map((table) => ({
        id: table.id,
        label: table.label,
        capacity: table.capacity,
        occupiedSlots: slots.filter((slot) =>
          activeBookings.some(
            (b) =>
              b.tableId === table.id &&
              this.slotsOverlap(slot, b.slotStart, b.slotEnd, settings.bookingDurationMinutes),
          ),
        ),
      }));
    } else {
      const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
      const seatsBySlot: Record<string, SeatsAvailability> = {};
      for (const slot of slots) {
        const occupied = activeBookings
          .filter((b) =>
            this.slotsOverlap(slot, b.slotStart, b.slotEnd, settings.bookingDurationMinutes),
          )
          .reduce((sum, b) => sum + b.guestCount, 0);
        seatsBySlot[slot] = {
          total: totalCapacity,
          occupied,
          remaining: Math.max(0, totalCapacity - occupied),
        };
      }
      base.seatsBySlot = seatsBySlot;
    }

    return base;
  }

  /**
   * Занятость столов на конкретный слот (date+time) — для guest-виджета планировки.
   * Возвращает список { tableId, busyUntil } для столов, занятых в окне [start, start+duration).
   */
  async getTablesAvailability(
    restaurantId: string,
    date: string,
    time: string,
  ): Promise<TablesAvailabilityResponse> {
    const settings = await this.bookingSettingsService.getSnapshot(restaurantId);
    const { start, end } = buildSlotRange(date, time, settings.bookingDurationMinutes);

    const withStatus = await this.bookingRepository
      .createQueryBuilder('booking')
      .select(['booking.tableId', 'booking.slotStart', 'booking.slotEnd', 'booking.status'])
      .where('booking.restaurantId = :restaurantId', { restaurantId })
      .andWhere('booking.bookingDate = :date', { date })
      .andWhere('booking.slotStart < :end', { end })
      .andWhere('booking.slotEnd > :start', { start })
      .andWhere('booking.status IN (:...statuses)', { statuses: ACTIVE_BOOKING_STATUSES })
      .getMany();

    const busy: TableBusyEntry[] = withStatus
      .filter((b) => b.tableId)
      .map((b) => ({
        tableId: b.tableId as string,
        busyUntil: new Date(b.slotEnd).toISOString(),
      }));

    return {
      date,
      time,
      durationMinutes: settings.bookingDurationMinutes,
      busy,
    };
  }

  private slotsOverlap(slot: string, bookingStart: Date, bookingEnd: Date, duration: number): boolean {
    const slotStart = new Date(`${slot}:00`);
    const slotEnd = new Date(slotStart.getTime() + duration * 60_000);
    return slotStart < bookingEnd && slotEnd > bookingStart;
  }

  private generateSlots(
    daySchedules: WorkSchedule[],
    slotMinutes: number,
    date: string,
  ): string[] {
    const isToday = date === todayString();
    const nowMin = isToday ? currentMinutesLocal() : -1;
    const slotSet = new Set<string>();

    for (const schedule of daySchedules) {
      const openMin = timeToMinutes(schedule.openTime.slice(0, 5));
      const closeMin = timeToMinutes(schedule.closeTime.slice(0, 5));
      for (let m = openMin; m + slotMinutes <= closeMin; m += slotMinutes) {
        if (m >= nowMin) {
          slotSet.add(minutesToTime(m));
        }
      }
    }

    return Array.from(slotSet).sort();
  }

  private async invalidateAvailabilityCache(restaurantId: string, date: string): Promise<void> {
    await this.cacheService.del(CacheKeys.tableAvailability(restaurantId, date));
  }

  async findByUser(userId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: { userId },
      order: { bookingDate: 'DESC', bookingTime: 'DESC' },
    });
  }

  async findByRestaurant(restaurantId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: { restaurantId },
      order: { bookingDate: 'ASC', bookingTime: 'ASC' },
    });
  }

  async updateStatus(
    bookingId: string,
    restaurantId: string,
    dto: UpdateBookingStatusDto,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, restaurantId },
    });

    if (!booking) {
      throw new NotFoundException('Бронирование не найдено');
    }

    booking.status = dto.status;
    return this.bookingRepository.save(booking);
  }

  async cancel(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new NotFoundException('Бронирование не найдено');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Бронирование уже отменено');
    }

    booking.status = BookingStatus.CANCELLED;
    const saved = await this.bookingRepository.save(booking);
    if (booking.tableId) {
      await this.invalidateAvailabilityCache(booking.restaurantId, booking.bookingDate);
    }
    return saved;
  }
}
