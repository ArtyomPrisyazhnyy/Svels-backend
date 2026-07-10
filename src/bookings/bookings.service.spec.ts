import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BOOKING_SETTINGS_SERVICE, FLOOR_PLANS_SERVICE } from '../common/constants/injection-tokens';
import { BookingMode } from '../common/enums/booking-mode.enum';
import { DepositScheme } from '../common/enums/deposit-scheme.enum';
import { CacheService } from '../cache/cache.service';
import type { BookingSettingsSnapshot, BookingSettingsService } from '../booking-settings/booking-settings.service';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import type { Table } from '../floor-plans/entities/table.entity';
import type { FloorPlansService } from '../floor-plans/floor-plans.service';
import { SchedulesService } from '../schedules/schedules.service';

const RESTAURANT_ID = '0197aaaa-aaaa-7aaa-aaaa-aaaaaaaaaaaa';
const USER_ID = '0197bbbb-bbbb-7bbb-bbbb-bbbbbbbbbbbb';
const TABLE_ID = '0197cccc-cccc-7ccc-cccc-cccccccccccc';
const FLOOR_PLAN_ID = '0197dddd-dddd-7ddd-dddd-dddddddddddd';

const SETTINGS: BookingSettingsSnapshot = {
  restaurantId: RESTAURANT_ID,
  bookingEnabled: true,
  mode: BookingMode.SPECIFIC_TABLE,
  depositScheme: DepositScheme.PER_TABLE,
  depositAmount: 10,
  bookingDurationMinutes: 120,
  slotMinutes: 30,
  maxGuests: 8,
  advanceDays: 14,
  autoConfirm: false,
};

const TABLE: Partial<Table> = {
  id: TABLE_ID,
  restaurantId: RESTAURANT_ID,
  floorPlanId: FLOOR_PLAN_ID,
  label: 'Стол 1',
  capacity: 4,
  minCapacity: 1,
  isActive: true,
  visibleToGuests: true,
  depositAmount: 20,
  shape: 'rectangle' as never,
  objectType: 'table' as never,
  rotation: 0,
  width: 90,
  height: 90,
  positionX: 0,
  positionY: 0,
  description: null,
};

function futureDate(offsetDays = 1): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Fluent-builder мок для createQueryBuilder. `terminal` — итог getOne/getMany. */
function qbMock<T>(terminal: () => Promise<T>): Record<string, (...args: unknown[]) => unknown> {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const methods = ['setLock', 'where', 'andWhere', 'select', 'orderBy', 'limit'];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.getOne = jest.fn().mockImplementation(terminal);
  chain.getMany = jest.fn().mockImplementation(terminal);
  return chain;
}

describe('BookingsService — race condition guards', () => {
  let service: BookingsService;
  let bookingRepo: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let floorPlansService: { findTableById: jest.Mock; findFloorPlanById: jest.Mock; getActiveTables: jest.Mock };
  let bookingSettingsService: { getSnapshot: jest.Mock };
  let schedulesService: { getByRestaurant: jest.Mock };
  let cacheService: { tryLock: jest.Mock; unlock: jest.Mock; del: jest.Mock; delMany: jest.Mock; get: jest.Mock; set: jest.Mock; delByPattern: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  /**
   * Конфигурируем мок транзакции: `overlapFound` определяет, найдена ли пересекающаяся бронь.
   */
  function configureTransaction(overlapFound: boolean): void {
    dataSource.transaction.mockImplementation(async (_isolation: string, cb: (manager: unknown) => unknown) => {
      const manager = {
        getRepository: () => ({
          createQueryBuilder: () => qbMock(async () => TABLE),
        }),
        createQueryBuilder: () => qbMock(async () => (overlapFound
          ? { tableId: TABLE_ID, slotStart: new Date(), slotEnd: new Date() }
          : null)),
        create: (_entity: unknown, payload: Partial<Booking>) => ({ ...payload, id: 'new-booking-id' } as Booking),
        save: async <T>(entity: T) => entity,
      };
      return cb(manager);
    });
  }

  beforeEach(async () => {
    bookingRepo = { find: jest.fn().mockResolvedValue([]), createQueryBuilder: jest.fn().mockReturnValue(qbMock(async () => [])) };
    floorPlansService = {
      findTableById: jest.fn().mockResolvedValue(TABLE),
      findFloorPlanById: jest.fn().mockResolvedValue({ id: FLOOR_PLAN_ID, depositAmount: 15 }),
      getActiveTables: jest.fn().mockResolvedValue([TABLE]),
    };
    bookingSettingsService = { getSnapshot: jest.fn().mockResolvedValue(SETTINGS) };
    schedulesService = { getByRestaurant: jest.fn().mockResolvedValue([]) };
    cacheService = {
      tryLock: jest.fn().mockResolvedValue('token-1'),
      unlock: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      delMany: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: FLOOR_PLANS_SERVICE, useValue: floorPlansService },
        { provide: BOOKING_SETTINGS_SERVICE, useValue: bookingSettingsService },
        { provide: SchedulesService, useValue: schedulesService },
        { provide: CacheService, useValue: cacheService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  it('бросает ConflictException, если Redis-лок уже занят (параллельный запрос)', async () => {
    cacheService.tryLock.mockResolvedValue(null);

    await expect(
      service.create(RESTAURANT_ID, USER_ID, {
        tableId: TABLE_ID,
        bookingDate: futureDate(),
        bookingTime: '19:00',
        guestCount: 2,
      }),
    ).rejects.toThrow(ConflictException);

    expect(cacheService.unlock).not.toHaveBeenCalled();
  });

  it('бросает ConflictException, если в SERIALIZABLE-транзакции найден overlap брони', async () => {
    configureTransaction(true);

    await expect(
      service.create(RESTAURANT_ID, USER_ID, {
        tableId: TABLE_ID,
        bookingDate: futureDate(),
        bookingTime: '19:00',
        guestCount: 2,
      }),
    ).rejects.toThrow(ConflictException);

    expect(cacheService.unlock).toHaveBeenCalled();
  });

  it('успешно создаёт бронь и снимает депозит по схеме PER_TABLE', async () => {
    configureTransaction(false);

    const result = await service.create(RESTAURANT_ID, USER_ID, {
      tableId: TABLE_ID,
      bookingDate: futureDate(),
      bookingTime: '19:00',
      guestCount: 2,
    });

    expect(result.depositAmount).toBe(20);
    expect(result.tableId).toBe(TABLE_ID);
    expect(result.slotStart).toBeInstanceOf(Date);
    expect(result.slotEnd).toBeInstanceOf(Date);
    expect(result.slotEnd.getTime() - result.slotStart.getTime()).toBe(120 * 60_000);
    expect(cacheService.unlock).toHaveBeenCalled();
  });

  it('бросает NotFoundException, если стол не принадлежит ресторану', async () => {
    floorPlansService.findTableById.mockResolvedValue({ ...TABLE, restaurantId: 'other' });

    await expect(
      service.create(RESTAURANT_ID, USER_ID, {
        tableId: TABLE_ID,
        bookingDate: futureDate(),
        bookingTime: '19:00',
        guestCount: 2,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('бросает BadRequestException, если гостей меньше minCapacity стола', async () => {
    floorPlansService.findTableById.mockResolvedValue({ ...TABLE, minCapacity: 3 });

    await expect(
      service.create(RESTAURANT_ID, USER_ID, {
        tableId: TABLE_ID,
        bookingDate: futureDate(),
        bookingTime: '19:00',
        guestCount: 2,
      }),
    ).rejects.toThrow();
  });
});

describe('BookingsService — getTablesAvailability', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getRepositoryToken(Booking),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(qbMock(async () => [])) },
        },
        { provide: FLOOR_PLANS_SERVICE, useValue: { findTableById: jest.fn(), findFloorPlanById: jest.fn(), getActiveTables: jest.fn().mockResolvedValue([]) } },
        { provide: BOOKING_SETTINGS_SERVICE, useValue: { getSnapshot: jest.fn().mockResolvedValue(SETTINGS) } },
        { provide: SchedulesService, useValue: { getByRestaurant: jest.fn() } },
        { provide: CacheService, useValue: { tryLock: jest.fn(), unlock: jest.fn(), del: jest.fn(), delMany: jest.fn(), get: jest.fn(), set: jest.fn(), delByPattern: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();
    service = module.get(BookingsService);
  });

  it('возвращает пустой список занятых столов при отсутствии броней', async () => {
    const result = await service.getTablesAvailability(RESTAURANT_ID, futureDate(), '19:00');
    expect(result.busy).toEqual([]);
    expect(result.durationMinutes).toBe(120);
  });
});
