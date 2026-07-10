import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { generateUuidV7 } from '../common/utils/uuid.util';
import {
  RegisterRestaurantDto,
  ReviewRegistrationDto,
  UpdateRestaurantDto,
} from './dto/restaurant.dto';
import { ResolveDomainQueryDto } from './dto/resolve-domain.dto';
import { RestaurantsService } from './restaurants.service';

const ALLOWED_LOGO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get()
  findAll() {
    return this.restaurantsService.findAll();
  }

  @Get('admin/registrations/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  getPendingRegistrations() {
    return this.restaurantsService.getPendingRegistrations();
  }

  @Post('admin/registrations/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  reviewRegistration(@Body() dto: ReviewRegistrationDto) {
    return this.restaurantsService.reviewRegistration(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  register(
    @Body() dto: RegisterRestaurantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restaurantsService.register(dto, user.id);
  }

  @Get('registrations/me')
  @UseGuards(JwtAuthGuard)
  getMyRegistration(@CurrentUser() user: AuthenticatedUser) {
    return this.restaurantsService.findRegistrationByApplicant(user.id);
  }

  @Get('resolve-domain')
  resolveDomain(@Query() query: ResolveDomainQueryDto) {
    return this.restaurantsService.resolveByDomain(query.host);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidV7Pipe) id: string) {
    return this.restaurantsService.findById(id);
  }

  @Post(':restaurantId/upload-logo')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  async uploadLogo(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    if (!ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Допустимы только JPG, PNG и WebP');
    }

    const buffer = await file.toBuffer();
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Размер файла не должен превышать 5 МБ');
    }

    const extension = extname(file.filename) || '.jpg';
    const fileName = `${generateUuidV7()}${extension}`;
    const directory = join(process.cwd(), 'uploads', 'restaurants', restaurantId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), buffer);

    return { logoUrl: `/uploads/restaurants/${restaurantId}/${fileName}` };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @Roles(UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurantsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseUuidV7Pipe) id: string) {
    return this.restaurantsService.remove(id);
  }
}
