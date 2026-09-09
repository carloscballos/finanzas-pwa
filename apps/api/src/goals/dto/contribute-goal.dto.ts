import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsUUID, NotEquals } from 'class-validator';

export class ContributeGoalDto {
  @ApiProperty({
    example: 500,
    description: 'Positivo para aportar, negativo para retirar. No puede ser 0.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @NotEquals(0)
  amount: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'Cuenta de la que sale el aporte (o a la que vuelve un retiro) — debe estar en la misma moneda que la meta. Se crea un movimiento real en esa cuenta.',
  })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    description: 'Fecha del aporte/retiro (default: ahora)',
    example: '2026-08-10T18:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
