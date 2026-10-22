import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [DashboardModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
