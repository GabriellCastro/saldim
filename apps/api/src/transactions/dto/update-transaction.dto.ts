import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CATEGORIES } from '../../categories/categories';
import { UNEXPECTED_TYPES } from '../../categories/unexpected';

/** Recategorizar e/ou marcar como imprevisto. `unexpected: null` desmarca (e apaga a justificativa). */
export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(CATEGORIES.map((c) => c.id))
  category?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsIn(UNEXPECTED_TYPES.map((u) => u.id))
  unexpected?: string | null;

  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(200)
  unexpectedNote?: string | null;
}
