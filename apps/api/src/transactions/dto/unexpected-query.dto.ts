import { IsOptional, Matches } from 'class-validator';

export class UnexpectedQueryDto {
  /** YYYY-MM ou 'all'; padrão = mês do lançamento mais recente */
  @IsOptional()
  @Matches(/^(\d{4}-(0[1-9]|1[0-2])|all)$/, { message: "month deve ser YYYY-MM ou 'all'" })
  month?: string;
}
