import { Body, Controller, HttpCode, Patch, Post, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { setAuthCookie } from '../auth/auth-cookie';
import { toUserDto } from './user.dto';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EmailConfirmDto, EmailRequestDto } from './dto/email-change.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('settings')
  settings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(user.id, dto);
  }

  @Post('email/request')
  @HttpCode(200)
  requestEmail(@CurrentUser() user: AuthUser, @Body() dto: EmailRequestDto) {
    return this.users.requestEmailChange(user.id, dto);
  }

  @Post('email/confirm')
  @HttpCode(200)
  async confirmEmail(
    @CurrentUser() user: AuthUser,
    @Body() dto: EmailConfirmDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const updated = await this.users.confirmEmailChange(user.id, dto);
    // Reemite o cookie para o JWT carregar o e-mail novo.
    await setAuthCookie(res, this.jwt, updated);
    return toUserDto(updated);
  }

  @Post('password')
  @HttpCode(204)
  async password(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.users.changePassword(user.id, dto);
  }
}
