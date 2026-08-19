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
      'Monto total del movimiento a registrar — por defecto, la suma de las cuotas de las compras activas de la tarjeta',
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
