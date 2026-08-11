import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { CurrencyCode } from '../../common/currency';

export class CreateBudgetDto {
  @ApiProperty({ format: 'uuid', description: 'Categoría de gasto a presupuestar' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 3000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  limitAmount: number;

  @ApiPropertyOptional({
    enum: CurrencyCode,
    default: CurrencyCode.COP,
    description: 'Solo cuenta el gasto de cuentas en esta moneda',
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @ApiPropertyOptional({ enum: BudgetPeriod, default: BudgetPeriod.MONTHLY })
  @IsOptional()
  @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;
}
