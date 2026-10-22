import { Module } from '@nestjs/common';
import { OpenFinanceController } from './open-finance.controller';
import { OpenFinanceService } from './open-finance.service';

@Module({ controllers: [OpenFinanceController], providers: [OpenFinanceService] })
export class OpenFinanceModule {}
