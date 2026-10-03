import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, IsNumber, Min } from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Activar o desactivar la ejecución automática. Al activarla hay que enviar startDate; al desactivarla se borra el calendario.',
  })
  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;

  @ApiPropertyOptional({
    example: '2026-11-05',
    description: 'Primera fecha de la ejecución automática (YYYY-MM-DD, hora de Colombia), posterior a hoy',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe tener el formato YYYY-MM-DD' })
  startDate?: string;
}
