import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProvider } from '../common/enums/auth-provider.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { sanitizeText } from '../common/utils/sanitize.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import {
  GoogleProfileInput,
  IUsersService,
} from './interfaces/users-service.interface';

@Injectable()
export class UsersService implements IUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto, passwordHash: string): Promise<UserResponseDto> {
    const existing = await this.findByEmail(dto.email);
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

  async findByEmail(email: string): Promise<{
    id: string;
    email: string;
    passwordHash: string | null;
    role: User['role'];
    authProvider: AuthProvider;
    googleId: string | null;
  } | null> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        authProvider: true,
        googleId: true,
      },
    });
    return user;
  }

  async findByGoogleId(googleId: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findOne({ where: { googleId } });
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

    const byEmail = await this.userRepository.findOne({
      where: { email: profile.email },
    });

    if (byEmail) {
      if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
        throw new ConflictException('Email уже привязан к другому Google-аккаунту');
      }

      byEmail.googleId = profile.googleId;

      const saved = await this.userRepository.save(byEmail);
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

    return response;
  }
}
