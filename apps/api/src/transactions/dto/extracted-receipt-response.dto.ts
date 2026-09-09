import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SuggestedCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Comida' })
  name: string;

  @ApiPropertyOptional({ example: '🍔' })
  emoji: string | null;
}

// Puramente informativo — no crea ni modifica nada. El usuario final decide
// si usa estos valores para registrar el movimiento (ver
// TransactionsController.extractReceipt).
export class ExtractedReceiptResponseDto {
  @ApiProperty({ example: 'Éxito' })
  merchant: string;

  @ApiPropertyOptional({ example: 45000, description: 'null si no se pudo leer el monto con confianza' })
  amount: number | null;

  @ApiPropertyOptional({ example: '2026-08-10', description: 'Fecha detectada (YYYY-MM-DD), null si no aparece' })
  occurredAt: string | null;

  @ApiPropertyOptional({ type: SuggestedCategoryDto, description: 'null si ninguna categoría del usuario aplica con confianza' })
  suggestedCategory: SuggestedCategoryDto | null;
}
