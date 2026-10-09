import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { ANALYTICS_VISITS_THROTTLE } from './analytics-throttle.constants';
import { AnalyticsQueryDto, TrackVisitDto } from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('visits')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(ANALYTICS_VISITS_THROTTLE)
  trackVisit(
    @Body() dto: TrackVisitDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.analyticsService.trackVisit(dto.restaurantId, user?.id);
  }

  @Get('visits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  getVisitSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getVisitSummary(query);
  }
}
