import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';

export class PayslipItemDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  label!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsIn(['provento', 'desconto'])
  kind!: 'provento' | 'desconto';
}

export class CreatePayslipDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month deve ser YYYY-MM' })
  month!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gross!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  net!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayslipItemDto)
  items?: PayslipItemDto[];
}
