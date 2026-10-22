import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConnectTokenDto {
  /** reconectar/atualizar um item existente (modo update do widget) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  itemId?: string;

  /** a Pluggy tem um item deste usuário que nunca chegou aqui (ITEM_USER_ALREADY_EXISTS): deixa criar outro */
  @IsOptional()
  @IsBoolean()
  allowDuplicate?: boolean;
}

export class RegisterItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemId!: string;
}
