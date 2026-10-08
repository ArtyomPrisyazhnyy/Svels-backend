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
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Roles, StaffRoles } from '../common/decorators/roles.decorator';
import { RestaurantPermission } from '../common/enums/restaurant-permission.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RestaurantAccessGuard } from '../common/guards/restaurant-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MediaUploadService } from '../media/media-upload.service';
import {
  RegisterRestaurantDto,
  ReviewRegistrationDto,
  UpdateRestaurantDto,
} from './dto/restaurant.dto';
import { ResolveDomainQueryDto } from './dto/resolve-domain.dto';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly mediaUploadService: MediaUploadService,
  ) {}

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
  @StaffRoles(RestaurantPermission.MANAGE_BRANDING)
  async uploadLogo(
    @Param('restaurantId', ParseUuidV7Pipe) restaurantId: string,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const buffer = await file.toBuffer();
    const uploaded = await this.mediaUploadService.uploadLogo(
      restaurantId,
      buffer,
      file.mimetype,
    );

    return {
      logoUrl: uploaded.url,
      logoWebpUrl: uploaded.webpUrl,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, RestaurantAccessGuard)
  @StaffRoles(RestaurantPermission.MANAGE_RESTAURANT)
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
