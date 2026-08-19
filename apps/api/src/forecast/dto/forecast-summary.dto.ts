import { ApiProperty } from '@nestjs/swagger';

export class ForecastSummaryDto {
  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiProperty({ example: 5000, description: 'Ingreso mensual proyectado a partir de movimientos recurrentes activos' })
  projectedMonthlyIncome: number;

  @ApiProperty({
    example: 3200,
    description: 'Gasto mensual proyectado: movimientos recurrentes activos + cuota mensual de compras a cuotas activas',
  })
  projectedMonthlyExpense: number;

  @ApiProperty({
    example: 450,
    description: 'De projectedMonthlyExpense, cuánto corresponde a cuotas de compras a crédito activas (ya incluido, se muestra aparte para transparencia)',
  })
  projectedMonthlyCardInstallments: number;

  @ApiProperty({ example: 1800 })
  projectedMonthlyNet: number;
}
