import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class PayLoanDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta desde la que se paga la cuota' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    example: 950000,
    description: 'Monto a pagar — por defecto, el valor de la cuota (installmentAmount), recortado al saldo pendiente',
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
