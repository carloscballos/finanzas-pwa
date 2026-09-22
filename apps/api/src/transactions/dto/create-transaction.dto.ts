import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '@prisma/client';
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

export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta a la que pertenece el movimiento' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Requerido si status es CONFIRMED; opcional para PENDING (se completa al revisar)',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 250.5, description: 'Siempre positivo; el signo lo da `type`' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Súper del fin de semana' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @ApiPropertyOptional({
    description: 'Fecha del movimiento (default: ahora)',
    example: '2026-08-10T18:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    default: TransactionStatus.CONFIRMED,
    description: 'Estado del movimiento: PENDING si es un pago registrado desde Wallet, CONFIRMED por defecto',
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}
