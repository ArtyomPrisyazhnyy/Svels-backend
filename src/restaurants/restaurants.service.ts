import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantStatus } from '../common/enums/restaurant-status.enum';
import { sanitizeText } from '../common/utils/sanitize.util';
import {
  CreateRestaurantDto,
  RegisterRestaurantDto,
  ReviewRegistrationDto,
  UpdateRestaurantDto,
} from './dto/restaurant.dto';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantRegistrationRequest } from './entities/restaurant-registration-request.entity';
import { RestaurantApprovedEvent } from './events/restaurant-approved.event';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @InjectRepository(RestaurantRegistrationRequest)
    private readonly registrationRepository: Repository<RestaurantRegistrationRequest>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterRestaurantDto, applicantId: string): Promise<RestaurantRegistrationRequest> {
    const locations = dto.locations.map((loc) => ({
      label: loc.label ? sanitizeText(loc.label) : undefined,
      address: sanitizeText(loc.address),
    }));

    const request = this.registrationRepository.create({
      name: sanitizeText(dto.name),
      description: dto.description ? sanitizeText(dto.description) : null,
      address: locations[0].address,
      unp: dto.unp,
      isChain: dto.isChain,
      locations,
      applicantId,
      status: RestaurantStatus.PENDING,
    });

    return this.registrationRepository.save(request);
  }

  async findAll(): Promise<RestaurantResponseDto[]> {
    const restaurants = await this.restaurantRepository.find({
      where: { status: RestaurantStatus.APPROVED },
    });
    return restaurants.map((r) => this.toResponse(r));
  }

  async findById(id: string): Promise<RestaurantResponseDto> {
    const restaurant = await this.restaurantRepository.findOne({ where: { id } });
    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }
    return this.toResponse(restaurant);
  }

  async update(id: string, dto: UpdateRestaurantDto): Promise<RestaurantResponseDto> {
    const restaurant = await this.restaurantRepository.findOne({ where: { id } });
    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }

    if (dto.name) restaurant.name = sanitizeText(dto.name);
    if (dto.description !== undefined) {
      restaurant.description = dto.description ? sanitizeText(dto.description) : null;
    }
    if (dto.address) restaurant.address = sanitizeText(dto.address);

    const saved = await this.restaurantRepository.save(restaurant);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.restaurantRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('Ресторан не найден');
    }
  }

  async findRegistrationByApplicant(
    applicantId: string,
  ): Promise<{
    id: string;
    name: string;
    status: RestaurantStatus;
    rejectionReason: string | null;
    createdAt: Date;
  } | null> {
    const request = await this.registrationRepository.findOne({
      where: { applicantId },
      order: { createdAt: 'DESC' },
    });

    if (!request) {
      return null;
    }

    return {
      id: request.id,
      name: request.name,
      status: request.status,
      rejectionReason: request.rejectionReason,
      createdAt: request.createdAt,
    };
  }

  async getPendingRegistrations(): Promise<RestaurantRegistrationRequest[]> {
    return this.registrationRepository.find({
      where: { status: RestaurantStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async reviewRegistration(dto: ReviewRegistrationDto): Promise<RestaurantResponseDto | RestaurantRegistrationRequest> {
    const request = await this.registrationRepository.findOne({
      where: { id: dto.requestId },
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    if (request.status !== RestaurantStatus.PENDING) {
      throw new BadRequestException('Заявка уже обработана');
    }

    if (dto.action === 'reject') {
      request.status = RestaurantStatus.REJECTED;
      request.rejectionReason = dto.rejectionReason
        ? sanitizeText(dto.rejectionReason)
        : null;
      return this.registrationRepository.save(request);
    }

    const locations = request.locations?.length
      ? request.locations
      : [{ address: request.address }];

    let saved = null as Restaurant | null;

    for (const location of locations) {
      const restaurantName =
        request.isChain && location.label
          ? `${request.name} — ${location.label}`
          : request.name;

      const restaurant = this.restaurantRepository.create({
        name: sanitizeText(restaurantName),
        description: request.description,
        address: sanitizeText(location.address),
        unp: request.unp,
        ownerId: request.applicantId,
        status: RestaurantStatus.APPROVED,
      });

      saved = await this.restaurantRepository.save(restaurant);
    }

    if (!saved) {
      throw new BadRequestException('Не указаны адреса заведения');
    }

    request.status = RestaurantStatus.APPROVED;
    await this.registrationRepository.save(request);

    this.eventEmitter.emit(
      'restaurant.approved',
      new RestaurantApprovedEvent(saved.id, saved.ownerId),
    );

    return this.toResponse(saved);
  }

  async createByAdmin(dto: CreateRestaurantDto, ownerId: string): Promise<RestaurantResponseDto> {
    const restaurant = this.restaurantRepository.create({
      name: sanitizeText(dto.name),
      description: dto.description ? sanitizeText(dto.description) : null,
      address: sanitizeText(dto.address),
      unp: null,
      ownerId,
      status: RestaurantStatus.APPROVED,
    });

    const saved = await this.restaurantRepository.save(restaurant);
    return this.toResponse(saved);
  }

  private toResponse(restaurant: Restaurant): RestaurantResponseDto {
    return {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      address: restaurant.address,
      status: restaurant.status,
      ownerId: restaurant.ownerId,
      createdAt: restaurant.createdAt,
    };
  }
}
