import { IsNotEmpty, IsString } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Informa tua senha atual' })
  currentPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informa a nova senha' })
  newPassword!: string;
}
