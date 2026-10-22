import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { MonthParamDto, MonthQueryDto, ProjectionQueryDto, SpendingQueryDto } from './dto/dashboard-query.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Query() q: MonthQueryDto) {
    return this.dashboard.overview(user.id, q);
  }

  @Get('spending')
  spending(@CurrentUser() user: AuthUser, @Query() q: SpendingQueryDto) {
    return this.dashboard.spending(user.id, q);
  }

  @Get('projection')
  projection(@CurrentUser() user: AuthUser, @Query() q: ProjectionQueryDto) {
    return this.dashboard.projection(user.id, q);
  }

  @Get('month/:month')
  month(@CurrentUser() user: AuthUser, @Param() p: MonthParamDto) {
    return this.dashboard.month(user.id, p.month);
  }
}
