import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardPurchaseStatus } from '@prisma/client';

class CardPurchaseAccountSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Visa Platino' })
  name: string;

  @ApiProperty({ example: 'COP' })
  currency: string;
}

export class CardPurchaseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Falabella' })
  merchant: string;

  @ApiProperty({ example: 1200000 })
  amount: number;

  @ApiProperty({ example: 900000 })
  remainingBalance: number;

  @ApiProperty({ example: 12 })
  installmentsTotal: number;

  @ApiProperty({ example: 3 })
  installmentsPaid: number;

  @ApiProperty({ example: 100000 })
  installmentAmount: number;

  @ApiPropertyOptional({ example: 2.5, nullable: true, description: '% de interés mensual, solo informativo' })
  interestRate: number | null;

  @ApiPropertyOptional({
    example: 15000,
    nullable: true,
    description:
      'Interés real que el extracto más reciente mostró para la cuota pendiente — se usa para precargar el pago en vez de estimarlo. null si no hay uno vigente (ya se pagó esa cuota, o la compra no vino de un extracto).',
  })
  lastStatementInterestAmount: number | null;

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  purchasedAt: Date;

  @ApiProperty({ type: CardPurchaseAccountSummaryDto })
  account: CardPurchaseAccountSummaryDto;

  @ApiProperty({ enum: CardPurchaseStatus, example: CardPurchaseStatus.ACTIVE })
  status: CardPurchaseStatus;

  @ApiProperty({ example: 25, description: 'Porcentaje del monto original ya pagado (0-100)' })
  percentPaid: number;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
