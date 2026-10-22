import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { MonthQueryDto } from '../dashboard/dto/dashboard-query.dto';
import { BudgetsService } from './budgets.service';
import { SetBudgetDto } from './dto/set-budget.dto';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: MonthQueryDto) {
    return this.budgets.list(user.id, q);
  }

  @Put(':category')
  set(@CurrentUser() user: AuthUser, @Param('category') category: string, @Body() dto: SetBudgetDto) {
    return this.budgets.set(user.id, category, dto.amount);
  }
}
