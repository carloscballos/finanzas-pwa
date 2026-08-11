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

  @ApiProperty({ type: TransactionCategorySummaryDto })
  category: TransactionCategorySummaryDto;

  @ApiProperty({ format: 'uuid' })
  createdByUserId: string;

  @ApiProperty({ example: '2026-08-10T18:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T18:00:00.000Z' })
  updatedAt: Date;
}
