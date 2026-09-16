import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

// principal, currency, installmentsTotal y accountId quedan fijos tras crear
// (mismo criterio que Budget/Goal). Lo que SÍ se edita es lo que se concilia
// contra cada extracto: la cuota real, la tasa, el seguro y el saldo de
// capital — corregirlos no toca ningún movimiento ya registrado, solo el
// plan hacia adelante (misma excepción deliberada que CardPurchase).
export class UpdateLoanDto {
  @ApiPropertyOptional({ example: 'Préstamo carro' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 24.88, description: 'Tasa efectiva anual (%)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  interestRate?: number;

  @ApiPropertyOptional({ example: 293760.7, description: 'Valor total de la cuota según el último extracto' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  installmentAmount?: number;

  @ApiPropertyOptional({ example: 11653, description: 'Seguro / cargos fijos por cuota' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  insuranceAmount?: number;

  @ApiPropertyOptional({
    example: 9633016.27,
    description: 'Ajusta el saldo de capital al del extracto (no crea ni modifica movimientos)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  remainingBalance?: number;

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;
}
