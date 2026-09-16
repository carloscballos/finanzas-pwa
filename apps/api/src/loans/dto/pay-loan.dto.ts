import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';

export class PayLoanDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta desde la que se paga la cuota' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    example: 293760.7,
    description:
      'Total pagado — por defecto, la próxima cuota del plan (interés + capital + seguro, recortada al saldo en la última)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    example: 102026.49,
    description:
      'Abono a capital según el extracto. Si se omite, se calcula: total − interés del período (saldo × tasa mensual) − seguro. Úsalo para abonos extraordinarios a capital.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  principalAmount?: number;

  @ApiPropertyOptional({ example: '2026-09-11T14:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
