import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { NextGoalDto, SaveGoalDto, SavedDto } from './dto/goal.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.goals.current(user.id);
  }

  @Put('current')
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveGoalDto) {
    return this.goals.save(user.id, dto);
  }

  @Post('current/next')
  next(@CurrentUser() user: AuthUser, @Body() dto: NextGoalDto) {
    return this.goals.next(user.id, dto);
  }

  @Put('saved')
  saved(@CurrentUser() user: AuthUser, @Body() dto: SavedDto) {
    return this.goals.setSaved(user.id, dto.amount);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.goals.history(user.id);
  }
}
