import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class PayCardPurchaseInstallmentDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta desde la que se paga la cuota (no puede ser la tarjeta)' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    example: 100000,
    description:
      'Capital a pagar — por defecto, el valor de la cuota (installmentAmount), recortado al saldo pendiente. Reduce remainingBalance y es lo que se acredita en la tarjeta.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    example: 15000,
    description:
      'Interés que el banco cobra este mes junto con la cuota (opcional) — se descuenta de la cuenta que paga, pero no se acredita en la tarjeta ni afecta el saldo pendiente de la compra, porque el banco lo cobra aparte del capital.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  interestAmount?: number;

  @ApiPropertyOptional({ example: '2026-08-13T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
