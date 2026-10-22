import { IsNumber, Max, Min } from 'class-validator';

export class SetBudgetDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  amount!: number;
}
