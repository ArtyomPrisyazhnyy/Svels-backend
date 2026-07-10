import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { REGISTRATION_NOTIFICATION_PUBLISHER } from '../common/constants/injection-tokens';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { RestaurantRegistrationListener } from './listeners/restaurant-registration.listener';
import { RegistrationNotificationsService } from './services/registration-notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminNotificationsController],
  providers: [
    RegistrationNotificationsService,
    RestaurantRegistrationListener,
    {
      provide: REGISTRATION_NOTIFICATION_PUBLISHER,
      useExisting: RegistrationNotificationsService,
    },
  ],
  exports: [REGISTRATION_NOTIFICATION_PUBLISHER],
})
export class NotificationsModule {}
