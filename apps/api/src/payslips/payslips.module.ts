import { Module } from '@nestjs/common';
import { PayslipsController } from './payslips.controller';
import { PayslipsService } from './payslips.service';

@Module({ controllers: [PayslipsController], providers: [PayslipsService], exports: [PayslipsService] })
export class PayslipsModule {}
