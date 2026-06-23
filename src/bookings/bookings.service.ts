import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FLOOR_PLANS_SERVICE } from '../common/constants/injection-tokens';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { sanitizeText } from '../common/utils/sanitize.util';
import { FloorPlansService } from '../floor-plans/floor-plans.service';
import { CreateBookingDto, UpdateBookingStatusDto } from './dto/booking.dto';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @Inject(FLOOR_PLANS_SERVICE)
    private readonly floorPlansService: FloorPlansService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    restaurantId: string,
    userId: string,
    dto: CreateBookingDto,
  ): Promise<Booking> {
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

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager
        .createQueryBuilder(Booking, 'booking')
        .setLock('pessimistic_write')
        .where('booking.tableId = :tableId', { tableId: dto.tableId })
        .andWhere('booking.bookingDate = :bookingDate', { bookingDate: dto.bookingDate })
        .andWhere('booking.bookingTime = :bookingTime', { bookingTime: dto.bookingTime })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        })
        .getOne();

      if (existing) {
        throw new BadRequestException('Стол уже забронирован на это время');
      }

      const booking = manager.create(Booking, {
        restaurantId,
        tableId: dto.tableId,
        userId,
        bookingDate: dto.bookingDate,
        bookingTime: dto.bookingTime,
        guestCount: dto.guestCount,
        notes: dto.notes ? sanitizeText(dto.notes) : null,
        status: BookingStatus.PENDING,
      });

      return manager.save(booking);
    });
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
    return this.bookingRepository.save(booking);
  }
}
