import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';

class BudgetCategorySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Comida' })
  name: string;

  @ApiPropertyOptional({ example: '🍔' })
  emoji: string | null;
}

export class BudgetResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: BudgetCategorySummaryDto })
  category: BudgetCategorySummaryDto;

  @ApiProperty({ example: 3000 })
  limitAmount: number;

  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiProperty({ enum: BudgetPeriod, example: BudgetPeriod.MONTHLY })
  period: BudgetPeriod;

  @ApiProperty({ example: 1250.75, description: 'Gastado en la categoría durante el periodo actual' })
  spent: number;

  @ApiProperty({ example: 1749.25 })
  remaining: number;

  @ApiProperty({ example: 42, description: 'Porcentaje del límite usado (puede superar 100)' })
  percentUsed: number;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  periodStart: Date;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  periodEnd: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
