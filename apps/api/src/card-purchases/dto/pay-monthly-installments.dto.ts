import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class PayMonthlyInstallmentsDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta tarjeta de crédito cuyas cuotas del mes se están pagando' })
  @IsUUID()
  cardAccountId: string;

  @ApiProperty({ format: 'uuid', description: 'Cuenta desde la que se paga (no puede ser la tarjeta)' })
  @IsUUID()
  payingAccountId: string;

  @ApiPropertyOptional({
    example: 365000,
    description:
      'Monto total que realmente sale de la cuenta que paga — puede incluir intereses del mes además del capital. Por defecto, la suma del capital de las cuotas de las compras activas (sin interés). Solo el capital de cada compra se acredita en la tarjeta; si este monto es mayor por incluir interés, esa diferencia no afecta el saldo de la tarjeta.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: '2026-08-13T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
