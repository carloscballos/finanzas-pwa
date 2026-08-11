import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// Todos los campos son opcionales: por default se crea el movimiento con los
// valores de la plantilla y fecha de hoy, pero el usuario puede editarlos
// antes de aplicar (ej. el monto de la renta subió este mes).
export class ApplyRecurringTransactionDto {
  @ApiPropertyOptional({ example: 1300, description: 'Default: el monto de la plantilla' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: 'Renta de agosto', description: 'Default: la nota de la plantilla' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @ApiPropertyOptional({
    example: '2026-08-15T00:00:00.000Z',
    description: 'Default: ahora',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
