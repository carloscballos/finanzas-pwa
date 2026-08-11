import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency, TransactionType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRecurringTransactionDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta donde se generará el movimiento' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 1200, description: 'Siempre positivo; el signo lo da `type`' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Renta del depa' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @ApiPropertyOptional({ enum: RecurrenceFrequency, default: RecurrenceFrequency.MONTHLY })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @ApiProperty({
    description: 'Fecha de la primera generación',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsISO8601()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Fecha en la que deja de generarse (opcional, indefinido si se omite)',
    example: '2027-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
