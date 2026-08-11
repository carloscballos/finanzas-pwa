import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency, TransactionType } from '@prisma/client';

class RecurringAccountSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Bbva Nomina' })
  name: string;

  @ApiProperty({ example: 'COP' })
  currency: string;
}

class RecurringCategorySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Renta' })
  name: string;

  @ApiPropertyOptional({ example: '🏠' })
  emoji: string | null;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type: TransactionType;
}

export class RecurringTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: RecurringAccountSummaryDto })
  account: RecurringAccountSummaryDto;

  @ApiProperty({ type: RecurringCategorySummaryDto })
  category: RecurringCategorySummaryDto;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type: TransactionType;

  @ApiProperty({ example: 1200 })
  amount: number;

  @ApiPropertyOptional({ example: 'Renta del depa' })
  note: string | null;

  @ApiProperty({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.MONTHLY,
    description: 'Informativa: solo se usa para la proyección mensual en /forecast',
  })
  frequency: RecurrenceFrequency;

  @ApiProperty({ example: true, description: 'Si esta plantilla cuenta en la proyección mensual' })
  active: boolean;

  @ApiPropertyOptional({
    example: '2026-09-01T01:00:00.000Z',
    description: 'Última vez que el usuario la aplicó (creó un movimiento a partir de ella)',
  })
  lastAppliedAt: Date | null;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
