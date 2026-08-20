import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

// amount/installmentsTotal/accountId quedan fijos tras crear (mismo criterio
// que Loan): cambiarlos dejaría remainingBalance inconsistente con el plan
// original. installmentAmount/interestRate sí son editables a propósito —
// para corregir la cuota estimada cuando llega el extracto real del banco
// (ver CardPurchasesService.update, que recalcula remainingBalance sin
// tocar movimientos ya registrados).
export class UpdateCardPurchaseDto {
  @ApiPropertyOptional({ example: 'Falabella' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  merchant?: string;

  @ApiPropertyOptional({ example: 105000, description: 'Corrige el valor de cada cuota pendiente' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  installmentAmount?: number;

  @ApiPropertyOptional({ example: 2.5, description: '% de interés mensual, solo informativo/de referencia' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  interestRate?: number;

  @ApiPropertyOptional({
    example: 15000,
    description:
      'Interés real que un extracto recién conciliado mostró para la cuota pendiente — se usa para precargar el pago en vez de estimarlo con la tasa.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  lastStatementInterestAmount?: number;
}
