import { Module } from '@nestjs/common';
import { OtpModule } from '../otp/otp.module';
import { DevController } from './dev.controller';

@Module({
  imports: [OtpModule],
  controllers: [DevController],
})
export class DevModule {}
