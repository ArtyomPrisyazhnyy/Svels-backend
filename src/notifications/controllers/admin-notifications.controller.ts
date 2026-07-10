import { Controller, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RegistrationNotificationsService } from '../services/registration-notifications.service';

@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(
    private readonly registrationNotificationsService: RegistrationNotificationsService,
  ) {}

  @Sse('registrations/stream')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  streamRegistrations(): Observable<MessageEvent> {
    return this.registrationNotificationsService.createStream();
  }
}
