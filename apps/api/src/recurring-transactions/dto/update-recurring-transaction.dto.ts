import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength, IsNumber, Min } from 'class-validator';

// Cuenta, categoría, tipo, frecuencia y fecha de inicio no se pueden cambiar
// después de creado (igual que en Budgets/Categories): borrar y crear de
// nuevo si cambia el plan de fondo. Sí se puede ajustar el monto, la nota,
// pausar/reactivar (active) y mover la fecha de fin.
export class UpdateRecurringTransactionDto {
  @ApiPropertyOptional({ example: 1300 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: 'Renta del depa (ajuste anual)' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @ApiPropertyOptional({ description: 'Pausar (false) o reactivar (true) la generación automática' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: '2027-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
