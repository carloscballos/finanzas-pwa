import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

// Solo campos informativos son editables tras crear — principal, currency,
// installmentsTotal/installmentAmount y accountId quedan fijos (mismo
// criterio que Budget/Goal: cambiarlos dejaría remainingBalance inconsistente
// con el plan original). Para eso hay que borrar y crear de nuevo.
export class UpdateLoanDto {
  @ApiPropertyOptional({ example: 'Préstamo carro' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  interestRate?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;
}
