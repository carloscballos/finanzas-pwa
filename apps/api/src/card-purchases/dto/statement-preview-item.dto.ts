import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StatementMatchType {
  NEW = 'NEW',
  BEHIND = 'BEHIND',
  UP_TO_DATE = 'UP_TO_DATE',
}

export class StatementPreviewItemDto {
  @ApiProperty({ example: 'Falabella' })
  merchant: string;

  @ApiProperty({ example: 1200000, description: 'Monto total estimado de la compra' })
  amount: number;

  @ApiProperty({ example: 12 })
  installmentsTotal: number;

  @ApiProperty({
    example: 100000,
    description:
      'Valor de la cuota SIN interés (capital) — es lo que se guarda como installmentAmount y lo único que amortiza el saldo pendiente. El interés no se suma acá: el banco lo cobra aparte y no puede afectar el saldo de la tarjeta.',
  })
  installmentAmount: number;

  @ApiPropertyOptional({
    example: 15000,
    description:
      'Interés de esta línea este mes, informativo — el extracto real a pagar es installmentAmount + interestAmount, pero solo installmentAmount se guarda/afecta el saldo de la tarjeta.',
  })
  interestAmount?: number;

  @ApiPropertyOptional({ example: 2.1, description: '% de interés de esta línea este mes, si el extracto lo mostraba' })
  interestRate?: number;

  @ApiProperty({ enum: StatementMatchType, example: StatementMatchType.NEW })
  matchType: StatementMatchType;

  @ApiPropertyOptional({
    example: 2,
    description: 'Solo si matchType es NEW: cuotas que ya estarían pagadas si se crea la compra ahora',
  })
  suggestedInstallmentsPaid?: number;

  @ApiPropertyOptional({
    example: '2026-07-15T00:00:00.000Z',
    description:
      'Solo si matchType es NEW: fecha a usar como purchasedAt — la propia de la línea si el extracto la mostraba, si no la fecha de corte del extracto. Puede faltar si no se pudo determinar ninguna.',
  })
  purchasedAt?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo si matchType es BEHIND o UP_TO_DATE' })
  purchaseId?: string;

  @ApiPropertyOptional({ example: 1, description: 'Cuotas pagadas registradas hoy en la app' })
  currentInstallmentsPaid?: number;

  @ApiPropertyOptional({ example: 3, description: 'Cuota actual según el extracto' })
  statementInstallmentCurrent?: number;

  @ApiPropertyOptional({ example: 2, description: 'Solo si matchType es BEHIND: cuántas cuotas hay que ponerse al día' })
  cuotasBehind?: number;
}
