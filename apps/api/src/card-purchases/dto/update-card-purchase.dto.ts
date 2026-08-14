import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Solo el comercio es editable tras crear — amount/installments/accountId
// quedan fijos (mismo criterio que Loan): cambiarlos dejaría remainingBalance
// inconsistente con el plan original.
export class UpdateCardPurchaseDto {
  @ApiPropertyOptional({ example: 'Falabella' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  merchant?: string;
}
