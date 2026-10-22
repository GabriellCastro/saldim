import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { cpfDigits, isValidCpf, passwordError } from '../users/rules';
import { toUserDto, type UserDto } from '../users/user.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

export const BCRYPT_ROUNDS = 10;
const INVALID_LOGIN = 'E-mail ou senha incorretos';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<User> {
    if (!isValidCpf(dto.cpf)) throw new BadRequestException('CPF inválido');
    const pwError = passwordError(dto.password);
    if (pwError) throw new BadRequestException(pwError);

    const cpf = cpfDigits(dto.cpf);
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { cpf }] },
      select: { email: true },
    });
    if (taken) {
      throw new ConflictException(
        taken.email === dto.email ? 'Já existe uma conta com esse e-mail' : 'Já existe uma conta com esse CPF',
      );
    }

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          cpf,
          phone: dto.phone,
          email: dto.email,
          passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe uma conta com esse e-mail ou CPF');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    return user;
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toUserDto(user);
  }
}
