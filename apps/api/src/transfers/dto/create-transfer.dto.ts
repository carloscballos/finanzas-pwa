import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta de origen (debes ser miembro)' })
  @IsUUID()
  fromAccountId: string;

  @ApiProperty({ format: 'uuid', description: 'Cuenta de destino (debes ser miembro)' })
  @IsUUID()
  toAccountId: string;

  @ApiProperty({ example: 100000, description: 'Monto en la moneda de la cuenta origen' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  fromAmount: number;

  @ApiPropertyOptional({
    example: 3900.5,
    description:
      'Solo si origen y destino tienen monedas distintas: cuántas unidades de la moneda destino equivalen a 1 de la moneda origen (toAmount = fromAmount × exchangeRate). Si se omite, se usa la TRM oficial automática.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: 'Ahorro del mes' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @ApiPropertyOptional({
    description: 'Fecha de la transferencia (default: ahora)',
    example: '2026-08-11T18:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
