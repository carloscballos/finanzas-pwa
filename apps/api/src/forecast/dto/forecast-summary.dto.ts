import { ApiProperty } from '@nestjs/swagger';

export class ForecastSummaryDto {
  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiProperty({ example: 5000, description: 'Ingreso mensual proyectado a partir de movimientos recurrentes activos' })
  projectedMonthlyIncome: number;

  @ApiProperty({ example: 3200, description: 'Gasto mensual proyectado a partir de movimientos recurrentes activos' })
  projectedMonthlyExpense: number;

  @ApiProperty({ example: 1800 })
  projectedMonthlyNet: number;
}
