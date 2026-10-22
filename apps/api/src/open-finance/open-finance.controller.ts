import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { ConnectTokenDto, RegisterItemDto } from './dto/open-finance.dto';
import { OpenFinanceService } from './open-finance.service';

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

@Controller('open-finance')
export class OpenFinanceController {
  constructor(private readonly openFinance: OpenFinanceService) {}

  @Post('connect-token')
  @HttpCode(200)
  connectToken(@CurrentUser() user: AuthUser, @Body() dto: ConnectTokenDto) {
    return this.openFinance.connectToken(user.id, dto.itemId, dto.allowDuplicate);
  }

  @Get('connections')
  list(@CurrentUser() user: AuthUser) {
    return this.openFinance.list(user.id);
  }

  @Post('connections')
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterItemDto) {
    return this.openFinance.register(user.id, dto.itemId);
  }

  @Post('connections/:id/sync')
  @HttpCode(200)
  sync(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.openFinance.sync(user.id, id);
  }

  @Delete('connections/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.openFinance.remove(user.id, id);
  }

  /** Webhook da Pluggy. Desligado (404) sem PLUGGY_WEBHOOK_SECRET; responde rápido e sincroniza em segundo plano. */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Query('secret') secret: string | undefined, @Body() body: { event?: string; itemId?: string }) {
    const expected = process.env.PLUGGY_WEBHOOK_SECRET;
    if (!expected || !secret || !sameSecret(secret, expected)) throw new NotFoundException();
    await this.openFinance.onWebhook(body);
    return { received: true };
  }
}
