import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class EmailRequestDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'E-mail inválido' })
  newEmail!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informa tua senha atual' })
  password!: string;
}

export class EmailConfirmDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'O código tem 6 números' })
  code!: string;
}
