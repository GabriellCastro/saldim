import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TrustedDeviceService } from './trusted-device.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TrustedDeviceService],
  exports: [AuthService, TrustedDeviceService],
})
export class AuthModule {}
