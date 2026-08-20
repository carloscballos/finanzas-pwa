import { ApiProperty } from '@nestjs/swagger';

export class ReconciliationCheckDto {
  @ApiProperty({ example: 'capital', description: 'capital | interest | minimumPayment | remainingDebt' })
  code: string;

  @ApiProperty({ example: 'Deuda a pagar este mes (capital)' })
  label: string;

  @ApiProperty({ example: 760740.35, description: 'Calculado sumando las líneas de detalle extraídas' })
  calculated: number;

  @ApiProperty({ example: 760740.35, description: 'Impreso en el resumen del extracto' })
  reported: number;

  @ApiProperty({ example: 0, description: 'calculated - reported' })
  difference: number;

  @ApiProperty({ example: true })
  ok: boolean;
}

export class StatementReconciliationDto {
  @ApiProperty({ example: true, description: 'true si todas las verificaciones que se pudieron hacer cuadraron' })
  ok: boolean;

  @ApiProperty({
    type: [ReconciliationCheckDto],
    description:
      'Solo incluye las verificaciones para las que el extracto mostró un total comparable — un extracto sin sección de resumen no genera ninguna',
  })
  checks: ReconciliationCheckDto[];
}
