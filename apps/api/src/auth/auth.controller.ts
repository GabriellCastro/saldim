import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { toUserDto } from '../users/user.dto';
import { clearAuthCookie, clearDeviceCookie, DEVICE_COOKIE, setAuthCookie, setDeviceCookie } from './auth-cookie';
import { AuthService } from './auth.service';
import { TrustedDeviceService } from './trusted-device.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly devices: TrustedDeviceService,
  ) {}

  /** Aberto por padrão; REGISTRATION_OPEN=false fecha (instância pessoal). A web lê a mesma variável. */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    if (process.env.REGISTRATION_OPEN === 'false') throw new ForbiddenException('Cadastro fechado');
    const user = await this.auth.register(dto);
    await setAuthCookie(res, this.jwt, user);
    return { user: toUserDto(user) };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto);
    await setAuthCookie(res, this.jwt, user);
    return { user: toUserDto(user) };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearAuthCookie(res);
  }

  /** Lembra este aparelho para "entrar com o rosto" (exige faceEnabled). */
  @Post('device')
  @HttpCode(204)
  async rememberDevice(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = await this.devices.remember(user.id, req.cookies?.[DEVICE_COOKIE]);
    setDeviceCookie(res, token);
  }

  /** Entra com o aparelho lembrado (cookie `saldim_device`), sem senha. */
  @Public()
  @Post('device/login')
  @HttpCode(200)
  async deviceLogin(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { user, token } = await this.devices.signIn(req.cookies?.[DEVICE_COOKIE]);
      setDeviceCookie(res, token);
      await setAuthCookie(res, this.jwt, user);
      return { user: toUserDto(user) };
    } catch (e) {
      if (e instanceof UnauthorizedException) clearDeviceCookie(res);
      throw e;
    }
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
