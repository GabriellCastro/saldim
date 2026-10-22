import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const toBool = ({ value }: { value: unknown }) => (value === undefined ? undefined : value === true || value === 'true' || value === '1');

export class MonthQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month deve ser YYYY-MM' })
  month?: string;

  /** força a data de "hoje" (padrão: data do lançamento mais recente) */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'today deve ser YYYY-MM-DD' })
  today?: string;
}

/** /dashboard/spending: além de YYYY-MM, aceita `all` (todos os meses). */
export class SpendingQueryDto {
  @IsOptional()
  @Matches(/^(\d{4}-(0[1-9]|1[0-2])|all)$/, { message: 'month deve ser YYYY-MM ou all' })
  month?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'today deve ser YYYY-MM-DD' })
  today?: string;
}

export class ProjectionQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  plan?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  countOther?: boolean;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'today deve ser YYYY-MM-DD' })
  today?: string;
}

/** /dashboard/month/:month */
export class MonthParamDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month deve ser YYYY-MM' })
  month!: string;
}
