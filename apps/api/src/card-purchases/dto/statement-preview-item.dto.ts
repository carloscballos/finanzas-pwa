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

  @ApiProperty({ example: 100000 })
  installmentAmount: number;

  @ApiProperty({ enum: StatementMatchType, example: StatementMatchType.NEW })
  matchType: StatementMatchType;

  @ApiPropertyOptional({
    example: 2,
    description: 'Solo si matchType es NEW: cuotas que ya estarían pagadas si se crea la compra ahora',
  })
  suggestedInstallmentsPaid?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo si matchType es BEHIND o UP_TO_DATE' })
  purchaseId?: string;

  @ApiPropertyOptional({ example: 1, description: 'Cuotas pagadas registradas hoy en la app' })
  currentInstallmentsPaid?: number;

  @ApiPropertyOptional({ example: 3, description: 'Cuota actual según el extracto' })
  statementInstallmentCurrent?: number;

  @ApiPropertyOptional({ example: 2, description: 'Solo si matchType es BEHIND: cuántas cuotas hay que ponerse al día' })
  cuotasBehind?: number;
}
