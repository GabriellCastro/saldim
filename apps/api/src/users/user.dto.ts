import type { User as DbUser } from '@prisma/client';
import { num } from '../common/money';
import { maskCpf } from './rules';

/** Formato `User` de docs/api.md. Use `toUserDto` sempre que responder um usuário. */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  cpfMasked: string;
  phone: string | null;
  faceEnabled: boolean;
  privacyMode: boolean;
  notifications: boolean;
  netIncome: number | null;
  grossIncome: number | null;
  otherIncome: number | null;
}

const money = (v: DbUser['netIncome']): number | null => (v == null ? null : num(v));

export function toUserDto(user: DbUser): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    cpfMasked: maskCpf(user.cpf),
    phone: user.phone,
    faceEnabled: user.faceEnabled,
    privacyMode: user.privacyMode,
    notifications: user.notifications,
    netIncome: money(user.netIncome),
    grossIncome: money(user.grossIncome),
    otherIncome: money(user.otherIncome),
  };
}
