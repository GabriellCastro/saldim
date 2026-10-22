import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLoanDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['FOLHA', 'CONTA'])
  source!: 'FOLHA' | 'CONTA';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  installment!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentInstallment!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalInstallments!: number;
}

export class UpdateLoanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['FOLHA', 'CONTA'])
  source?: 'FOLHA' | 'CONTA';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  installment?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentInstallment?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalInstallments?: number;
}
