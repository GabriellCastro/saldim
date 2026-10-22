import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deviceExpiry, hashDeviceToken, newDeviceToken } from './trusted-device';

const NOT_REMEMBERED = 'Este aparelho não está mais lembrado. Entra com a senha.';

/**
 * "Entrar com o rosto" = lembrar este aparelho. A varredura do web é ilustrativa;
 * quem autentica é o token do cookie `saldim_device`, trocado a cada uso.
 */
@Injectable()
export class TrustedDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lembra o aparelho atual. Se ele já tinha token, o antigo é descartado. Devolve o token novo (vai pro cookie). */
  async remember(userId: string, currentToken?: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { faceEnabled: true } });
    if (!user?.faceEnabled) throw new BadRequestException('Ativa o reconhecimento facial antes de lembrar o aparelho');
    if (currentToken) await this.prisma.trustedDevice.deleteMany({ where: { tokenHash: hashDeviceToken(currentToken) } });
    const token = newDeviceToken();
    await this.prisma.trustedDevice.create({
      data: { userId, tokenHash: hashDeviceToken(token), expiresAt: deviceExpiry() },
    });
    return token;
  }

  /** Troca um token válido por um novo e devolve o dono. Token inválido/expirado/rosto desligado → 401. */
  async signIn(token: string | undefined): Promise<{ user: User; token: string }> {
    if (!token) throw new UnauthorizedException(NOT_REMEMBERED);
    const device = await this.prisma.trustedDevice.findUnique({
      where: { tokenHash: hashDeviceToken(token) },
      include: { user: true },
    });
    if (!device || device.expiresAt < new Date() || !device.user.faceEnabled) {
      if (device) await this.prisma.trustedDevice.delete({ where: { id: device.id } });
      throw new UnauthorizedException(NOT_REMEMBERED);
    }
    const next = newDeviceToken();
    await this.prisma.trustedDevice.update({
      where: { id: device.id },
      data: { tokenHash: hashDeviceToken(next), expiresAt: deviceExpiry(), lastUsedAt: new Date() },
    });
    return { user: device.user, token: next };
  }

  /** Esquece todos os aparelhos do usuário (rosto desligado, senha trocada). */
  async forgetAll(userId: string): Promise<void> {
    await this.prisma.trustedDevice.deleteMany({ where: { userId } });
  }
}
