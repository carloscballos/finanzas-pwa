import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

class TransactionAccountSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ahorros Santander' })
  name: string;

  @ApiProperty({ example: 'MXN' })
  currency: string;
}

class TransactionCategorySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Comida' })
  name: string;

  @ApiPropertyOptional({ example: '🍔' })
  emoji: string | null;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type: TransactionType;
}

class TransactionCreatedBySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Carla' })
  name: string;
}

class TransactionTransferCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Cuenta USD' })
  name: string;
}

class TransactionGoalSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Enganche del carro' })
  name: string;
}

class TransactionLoanSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Préstamo carro' })
  name: string;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type: TransactionType;

  @ApiProperty({ example: 250.5 })
  amount: number;

  @ApiPropertyOptional({ example: 'Súper del fin de semana' })
  note: string | null;

  @ApiProperty({ example: '2026-08-10T18:00:00.000Z' })
  occurredAt: Date;

  @ApiProperty({ type: TransactionAccountSummaryDto })
  account: TransactionAccountSummaryDto;

  @ApiPropertyOptional({
    type: TransactionCategorySummaryDto,
    description: 'Null si el movimiento es una pata de una transferencia (ver transferId)',
  })
  category: TransactionCategorySummaryDto | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId: string;

  @ApiProperty({
    type: TransactionCreatedBySummaryDto,
    description: 'Quién registró el movimiento — relevante en cuentas compartidas',
  })
  createdBy: TransactionCreatedBySummaryDto;

  @ApiPropertyOptional({ format: 'uuid', description: 'Si este movimiento es parte de una transferencia' })
  transferId: string | null;

  @ApiPropertyOptional({
    type: TransactionTransferCounterpartyDto,
    description: 'La otra cuenta involucrada, solo si transferId no es null',
  })
  transferCounterpartyAccount: TransactionTransferCounterpartyDto | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Si es un aporte/retiro de una meta de ahorro' })
  goalId: string | null;

  @ApiPropertyOptional({ type: TransactionGoalSummaryDto })
  goal: TransactionGoalSummaryDto | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Si es el pago de la cuota de un préstamo' })
  loanId: string | null;

  @ApiPropertyOptional({ type: TransactionLoanSummaryDto })
  loan: TransactionLoanSummaryDto | null;

  @ApiProperty({ example: '2026-08-10T18:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T18:00:00.000Z' })
  updatedAt: Date;
}
