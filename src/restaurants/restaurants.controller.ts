import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/pipes/parse-uuid-v7.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  RegisterRestaurantDto,
  ReviewRegistrationDto,
  UpdateRestaurantDto,
} from './dto/restaurant.dto';
import { RestaurantsService } from './restaurants.service';

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

  @Get(':id')
  findOne(@Param('id', ParseUuidV7Pipe) id: string) {
    return this.restaurantsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
