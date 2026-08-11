import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, IsNumber, Min } from 'class-validator';

// Cuenta, categoría, tipo y frecuencia no se pueden cambiar después de
// creada (igual que en Budgets/Categories): borrar y crear de nuevo si
// cambia el plan de fondo. Sí se puede ajustar el monto, la nota, y si
// cuenta o no en la proyección mensual de /forecast (active).
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

  @ApiPropertyOptional({ description: 'Si esta plantilla cuenta en la proyección mensual' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
