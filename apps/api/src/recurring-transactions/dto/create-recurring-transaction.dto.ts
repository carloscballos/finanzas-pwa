import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency, TransactionType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class CreateRecurringTransactionDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta donde se creará el movimiento al aplicar' })
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

  @ApiPropertyOptional({
    enum: RecurrenceFrequency,
    default: RecurrenceFrequency.MONTHLY,
    description: 'Informativa: solo se usa para la proyección mensual en /forecast',
  })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @ApiPropertyOptional({
    default: false,
    description: 'Si es true, el sistema registra el movimiento solo en cada fecha (requiere startDate)',
  })
  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;

  @ApiPropertyOptional({
    example: '2026-11-05',
    description: 'Primera fecha de la ejecución automática (YYYY-MM-DD, hora de Colombia). Debe ser posterior a hoy.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe tener el formato YYYY-MM-DD' })
  startDate?: string;
}
