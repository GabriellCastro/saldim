import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { UnexpectedQueryDto } from './dto/unexpected-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListTransactionsDto) {
    return this.transactions.list(user.id, q);
  }

  @Get('unexpected')
  unexpected(@CurrentUser() user: AuthUser, @Query() q: UnexpectedQueryDto) {
    return this.transactions.unexpected(user.id, q);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactions.update(user.id, id, dto);
  }
}
