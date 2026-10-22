import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { AccountsService } from './accounts.service';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.accounts.list(user.id);
  }
}
