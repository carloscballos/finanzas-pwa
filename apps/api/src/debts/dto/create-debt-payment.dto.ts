import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDebtPaymentDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Tu cuenta por donde se movió el dinero (de donde salió si eres el deudor, a donde entró si eres el acreedor) — el abono la refleja en tu saldo cuando quede confirmado',
  })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    example: 200,
    description:
      'Monto del abono — por defecto, el saldo pendiente completo (equivale a marcar la deuda como pagada)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: '2026-08-13T00:00:00.000Z', description: 'Fecha del abono (default: ahora)' })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @ApiPropertyOptional({ example: 'Abono en efectivo' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
