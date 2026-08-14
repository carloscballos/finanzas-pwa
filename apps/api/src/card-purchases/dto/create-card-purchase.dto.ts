import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCardPurchaseDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta tarjeta de crédito donde se hizo la compra' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: 'Falabella' })
  @IsString()
  @IsNotEmpty()
  merchant: string;

  @ApiProperty({ example: 1200000, description: 'Monto total original de la compra' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 12, description: 'Número total de cuotas' })
  @IsInt()
  @IsPositive()
  installmentsTotal: number;

  @ApiProperty({ example: 100000, description: 'Monto de cada cuota' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  installmentAmount: number;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z', description: 'Fecha de la compra (default ahora)' })
  @IsOptional()
  @IsISO8601()
  purchasedAt?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Cuotas que ya se pagaron antes de registrar la compra (para importar una compra en curso) — default 0',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number;
}
