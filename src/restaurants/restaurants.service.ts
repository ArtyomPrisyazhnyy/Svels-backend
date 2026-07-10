import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys } from '../cache/cache-keys';
import { CacheService } from '../cache/cache.service';
import { RestaurantStatus } from '../common/enums/restaurant-status.enum';
import { isValidDomain, normalizeDomain } from '../common/utils/normalize-domain.util';
import { sanitizeText } from '../common/utils/sanitize.util';
import {
  CreateRestaurantDto,
  RegisterRestaurantDto,
  ReviewRegistrationDto,
  UpdateRestaurantDto,
} from './dto/restaurant.dto';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { ResolveDomainResponseDto } from './dto/resolve-domain.dto';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantRegistrationRequest } from './entities/restaurant-registration-request.entity';
import { RestaurantApprovedEvent } from './events/restaurant-approved.event';
import { RestaurantRegistrationReviewedEvent } from './events/restaurant-registration-reviewed.event';
import { RestaurantRegistrationSubmittedEvent } from './events/restaurant-registration-submitted.event';
import { PendingRegistrationDto } from '../shared/dto/pending-registration.dto';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @InjectRepository(RestaurantRegistrationRequest)
    private readonly registrationRepository: Repository<RestaurantRegistrationRequest>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
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

    const saved = await this.registrationRepository.save(request);

    this.eventEmitter.emit(
      'restaurant.registration.submitted',
      new RestaurantRegistrationSubmittedEvent(this.toRegistrationPayload(saved)),
    );

    return saved;
  }

  async findAll(): Promise<RestaurantResponseDto[]> {
    const restaurants = await this.restaurantRepository.find({
      where: { status: RestaurantStatus.APPROVED },
    });
    return restaurants.map((r) => this.toResponse(r));
  }

  async resolveByDomain(rawHost: string): Promise<ResolveDomainResponseDto> {
    let domain: string;

    try {
      domain = normalizeDomain(rawHost);
    } catch {
      throw new BadRequestException('Некорректный домен');
    }

    if (!isValidDomain(domain)) {
      throw new BadRequestException('Некорректный домен');
    }

    const cacheKey = CacheKeys.restaurantByDomain(domain);
    const cached = await this.cacheService.get<ResolveDomainResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const restaurant = await this.restaurantRepository.findOne({
      where: { customDomain: domain, status: RestaurantStatus.APPROVED },
    });

    if (!restaurant) {
      throw new NotFoundException('Заведение для этого домена не найдено');
    }

    const response: ResolveDomainResponseDto = {
      id: restaurant.id,
      name: restaurant.name,
      customDomain: domain,
    };

    await this.cacheService.set(cacheKey, response);
    return response;
  }

  async findById(id: string): Promise<RestaurantResponseDto> {
    const restaurant = await this.restaurantRepository.findOne({ where: { id } });
    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }
    return this.toResponse(restaurant);
  }

  async ensureApproved(id: string): Promise<RestaurantResponseDto> {
    const restaurant = await this.restaurantRepository.findOne({ where: { id } });
    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }

    if (restaurant.status !== RestaurantStatus.APPROVED) {
      throw new BadRequestException('Заведение недоступно для регистрации гостей');
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

    if (dto.customDomain !== undefined) {
      const previousDomain = restaurant.customDomain;
      const nextDomain = await this.resolveCustomDomainUpdate(id, dto.customDomain);
      restaurant.customDomain = nextDomain;
      await this.invalidateDomainCache(previousDomain, nextDomain);
    }

    if (dto.logoUrl !== undefined) {
      restaurant.logoUrl = dto.logoUrl;
    }

    const saved = await this.restaurantRepository.save(restaurant);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const restaurant = await this.restaurantRepository.findOne({ where: { id } });
    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }

    if (restaurant.customDomain) {
      await this.cacheService.del(CacheKeys.restaurantByDomain(restaurant.customDomain));
    }

    await this.restaurantRepository.delete({ id });
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
      const saved = await this.registrationRepository.save(request);

      this.eventEmitter.emit(
        'restaurant.registration.reviewed',
        new RestaurantRegistrationReviewedEvent(saved.id),
      );

      return saved;
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

    this.eventEmitter.emit(
      'restaurant.registration.reviewed',
      new RestaurantRegistrationReviewedEvent(request.id),
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
      customDomain: restaurant.customDomain,
      logoUrl: restaurant.logoUrl,
      createdAt: restaurant.createdAt,
    };
  }

  private async resolveCustomDomainUpdate(
    restaurantId: string,
    rawDomain: string | null,
  ): Promise<string | null> {
    if (rawDomain === null || rawDomain === '') {
      return null;
    }

    let domain: string;

    try {
      domain = normalizeDomain(rawDomain);
    } catch {
      throw new BadRequestException('Некорректный домен');
    }

    if (!isValidDomain(domain)) {
      throw new BadRequestException('Некорректный домен');
    }

    const existing = await this.restaurantRepository.findOne({
      where: { customDomain: domain },
    });

    if (existing && existing.id !== restaurantId) {
      throw new ConflictException('Домен уже привязан к другому заведению');
    }

    return domain;
  }

  private async invalidateDomainCache(
    previousDomain: string | null,
    nextDomain: string | null,
  ): Promise<void> {
    if (previousDomain) {
      await this.cacheService.del(CacheKeys.restaurantByDomain(previousDomain));
    }

    if (nextDomain && nextDomain !== previousDomain) {
      await this.cacheService.del(CacheKeys.restaurantByDomain(nextDomain));
    }
  }

  private toRegistrationPayload(
    request: RestaurantRegistrationRequest,
  ): PendingRegistrationDto {
    return {
      id: request.id,
      name: request.name,
      description: request.description,
      address: request.address,
      unp: request.unp,
      isChain: request.isChain,
      locations: request.locations,
      applicantId: request.applicantId,
      status: request.status,
      createdAt: request.createdAt,
    };
  }
}
