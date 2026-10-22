import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { CATEGORIES } from '../../categories/categories';

export class ListTransactionsDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month deve ser YYYY-MM' })
  month?: string;

  @IsOptional()
  @IsIn(CATEGORIES.map((c) => c.id))
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
