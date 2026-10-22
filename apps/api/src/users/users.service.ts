import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { TrustedDeviceService } from '../auth/trusted-device.service';
import { passwordError } from './rules';
import { toUserDto, type UserDto } from './user.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import type { EmailConfirmDto, EmailRequestDto } from './dto/email-change.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';

export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

/** Código numérico de 6 dígitos (com zeros à esquerda). */
export const sixDigitCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: TrustedDeviceService,
  ) {}

  private async getUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  private async checkPassword(user: User, password: string): Promise<void> {
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('Senha atual incorreta');
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    await this.getUser(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone === undefined ? undefined : dto.phone || null },
    });
    return toUserDto(user);
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserDto> {
    await this.getUser(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { faceEnabled: dto.faceEnabled, privacyMode: dto.privacyMode, notifications: dto.notifications },
    });
    // rosto desligado: nenhum aparelho entra mais sem senha
    if (dto.faceEnabled === false) await this.devices.forgetAll(userId);
    return toUserDto(user);
  }

  async requestEmailChange(userId: string, dto: EmailRequestDto): Promise<{ sent: true; devCode?: string }> {
    const user = await this.getUser(userId);
    await this.checkPassword(user, dto.password);
    if (dto.newEmail === user.email) throw new BadRequestException('Esse já é teu e-mail atual');
    await this.assertEmailFree(dto.newEmail, userId);

    const code = sixDigitCode();
    // Um pedido pendente por vez: o novo substitui os anteriores.
    await this.prisma.$transaction([
      this.prisma.emailChange.deleteMany({ where: { userId } }),
      this.prisma.emailChange.create({
        data: { userId, newEmail: dto.newEmail, code, expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS) },
      }),
    ]);
    // Sem provedor de e-mail ainda: o código vai pro log (e devCode fora de produção).
    this.logger.log(`Código de troca de e-mail para ${dto.newEmail}: ${code}`);

    return process.env.NODE_ENV === 'production' ? { sent: true } : { sent: true, devCode: code };
  }

  async confirmEmailChange(userId: string, dto: EmailConfirmDto): Promise<User> {
    const pending = await this.prisma.emailChange.findFirst({
      where: { userId, code: dto.code, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) throw new BadRequestException('Código inválido ou expirado');
    await this.assertEmailFree(pending.newEmail, userId);

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { email: pending.newEmail } }),
      this.prisma.emailChange.deleteMany({ where: { userId } }),
    ]);
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.getUser(userId);
    await this.checkPassword(user, dto.currentPassword);
    const pwError = passwordError(dto.newPassword);
    if (pwError) throw new BadRequestException(pwError);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    // senha nova derruba os aparelhos lembrados (ex.: celular perdido)
    await this.devices.forgetAll(userId);
  }

  private async assertEmailFree(email: string, userId: string): Promise<void> {
    const other = await this.prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
    if (other) throw new ConflictException('Já existe uma conta com esse e-mail');
  }
}
