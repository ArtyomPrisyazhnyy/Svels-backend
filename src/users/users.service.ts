import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, IsNull, Repository } from 'typeorm';
import { AuthProvider } from '../common/enums/auth-provider.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { sanitizeText } from '../common/utils/sanitize.util';
import { buildGuestUserEmail } from '../common/utils/normalize-phone.util';
import { CreateGuestUserDto } from './dto/create-guest-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import {
  GoogleProfileInput,
  GuestAuthUserRecord,
  IUsersService,
  PlatformAuthUserRecord,
} from './interfaces/users-service.interface';

const PLATFORM_AUTH_ROLES = [UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN] as const;

const PLATFORM_AUTH_USER_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  role: true,
  authProvider: true,
  googleId: true,
  restaurantId: true,
} as const;

@Injectable()
export class UsersService implements IUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto, passwordHash: string): Promise<UserResponseDto> {
    const existing = await this.findPlatformUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: sanitizeText(dto.firstName),
      lastName: sanitizeText(dto.lastName),
      role: dto.role,
      restaurantId: dto.restaurantId ?? null,
      authProvider: AuthProvider.LOCAL,
      googleId: null,
    });

    const saved = await this.userRepository.save(user);
    return this.toResponse(saved);
  }

  async createGuest(
    dto: CreateGuestUserDto,
    passwordHash: string,
    restaurantId: string,
  ): Promise<UserResponseDto> {
    const existing = await this.findGuestByPhoneAndRestaurant(dto.phone, restaurantId);
    if (existing) {
      throw new ConflictException('Пользователь с таким номером уже зарегистрирован в этом заведении');
    }

    const user = this.userRepository.create({
      email: buildGuestUserEmail(restaurantId, dto.phone),
      phone: dto.phone,
      passwordHash,
      firstName: sanitizeText(dto.firstName),
      lastName: sanitizeText(dto.lastName),
      role: UserRole.USER,
      restaurantId,
      authProvider: AuthProvider.LOCAL,
      googleId: null,
    });

    const saved = await this.userRepository.save(user);
    return this.toResponse(saved);
  }

  async findByEmail(email: string): Promise<PlatformAuthUserRecord | null> {
    return this.findPlatformUserByEmail(email);
  }

  async findPlatformUserByEmail(email: string): Promise<PlatformAuthUserRecord | null> {
    const normalizedEmail = email.toLowerCase();

    const user = await this.userRepository.findOne({
      where: [
        { email: normalizedEmail, restaurantId: IsNull() },
        { email: normalizedEmail, role: In([...PLATFORM_AUTH_ROLES]) },
      ],
      select: PLATFORM_AUTH_USER_SELECT,
    });

    return user;
  }

  async findPlatformUserByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: [
        { googleId, restaurantId: IsNull() },
        { googleId, role: In([...PLATFORM_AUTH_ROLES]) },
      ],
    });
  }

  async findGuestByPhoneAndRestaurant(
    phone: string,
    restaurantId: string,
  ): Promise<GuestAuthUserRecord | null> {
    const user = await this.userRepository.findOne({
      where: {
        phone,
        restaurantId,
        role: UserRole.USER,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        passwordHash: true,
        role: true,
        authProvider: true,
        googleId: true,
        restaurantId: true,
      },
    });
    return user;
  }

  async findByGoogleId(googleId: string): Promise<UserResponseDto | null> {
    const user = await this.findPlatformUserByGoogleId(googleId);
    return user ? this.toResponse(user) : null;
  }

  async findById(id: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    return user ? this.toResponse(user) : null;
  }

  async findOrCreateFromGoogle(profile: GoogleProfileInput): Promise<UserResponseDto> {
    const byGoogleId = await this.findByGoogleId(profile.googleId);
    if (byGoogleId) {
      return byGoogleId;
    }

    const byEmail = await this.findPlatformUserByEmail(profile.email);

    if (byEmail) {
      const user = await this.userRepository.findOne({ where: { id: byEmail.id } });
      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }

      if (user.googleId && user.googleId !== profile.googleId) {
        throw new ConflictException('Email уже привязан к другому Google-аккаунту');
      }

      user.googleId = profile.googleId;

      const saved = await this.userRepository.save(user);
      return this.toResponse(saved);
    }

    const user = this.userRepository.create({
      email: profile.email,
      passwordHash: null,
      firstName: sanitizeText(profile.firstName),
      lastName: sanitizeText(profile.lastName || '-'),
      authProvider: AuthProvider.GOOGLE,
      googleId: profile.googleId,
    });

    const saved = await this.userRepository.save(user);
    return this.toResponse(saved);
  }

  async updateProfile(
    id: string,
    firstName?: string,
    lastName?: string,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (firstName) {
      user.firstName = sanitizeText(firstName);
    }
    if (lastName) {
      user.lastName = sanitizeText(lastName);
    }

    const saved = await this.userRepository.save(user);
    return this.toResponse(saved);
  }

  async updatePassword(id: string, password: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    user.passwordHash = await bcrypt.hash(password, 12);

    const saved = await this.userRepository.save(user);
    return this.toResponse(saved);
  }

  private toResponse(user: User): UserResponseDto {
    const response: UserResponseDto = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
    };

    if (user.role === UserRole.RESTAURANT_ADMIN && user.restaurantId) {
      response.restaurantId = user.restaurantId;
    }

    if (user.role === UserRole.USER && user.restaurantId) {
      response.restaurantId = user.restaurantId;
    }

    if (user.phone) {
      response.phone = user.phone;
    }

    return response;
  }
}
