import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

@Module({
  imports: [DashboardModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
