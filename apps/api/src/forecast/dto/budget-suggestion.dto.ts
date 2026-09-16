import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';

class SuggestionCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Comida' })
  name: string;

  @ApiPropertyOptional({ example: '🍔' })
  emoji: string | null;
}

class ExistingBudgetRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 1000 })
  limitAmount: number;

  @ApiProperty({ enum: BudgetPeriod, example: BudgetPeriod.MONTHLY })
  period: BudgetPeriod;
}

export class BudgetSuggestionDto {
  @ApiProperty({ type: SuggestionCategoryDto })
  category: SuggestionCategoryDto;

  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiProperty({
    example: 850.5,
    description:
      'Promedio de gasto mensual real en esta categoría/moneda, sobre los meses completos de historial que existen (hasta 3)',
  })
  averageMonthlySpend: number;

  @ApiProperty({
    example: 2,
    description:
      'Cuántos meses completos de historial respaldan el promedio (1 a 3) — un usuario nuevo tiene menos de 3',
  })
  monthsOfHistory: number;

  @ApiPropertyOptional({ type: ExistingBudgetRefDto })
  existingBudget: ExistingBudgetRefDto | null;
}
