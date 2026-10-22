import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FinanceDataService } from './finance-data.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, FinanceDataService],
  exports: [FinanceDataService],
})
export class DashboardModule {}
