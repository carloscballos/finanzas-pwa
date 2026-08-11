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

  @ApiProperty({ enum: RecurrenceFrequency, example: RecurrenceFrequency.MONTHLY })
  frequency: RecurrenceFrequency;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', description: 'Próxima fecha en que se generará' })
  nextRunDate: Date;

  @ApiPropertyOptional({ example: '2027-09-01T00:00:00.000Z' })
  endDate: Date | null;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiPropertyOptional({ example: '2026-09-01T01:00:00.000Z' })
  lastRunAt: Date | null;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
