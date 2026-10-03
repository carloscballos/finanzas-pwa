import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Enganche del carro' })
  name: string;

  @ApiProperty({ example: 50000 })
  targetAmount: number;

  @ApiProperty({
    example: 12500,
    description: 'Ahorrado hasta ahora: el saldo de la cuenta (oculta) que respalda la meta',
  })
  currentAmount: number;

  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiProperty({ example: 25, description: 'Porcentaje completado (0-100+)' })
  percentComplete: number;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  targetDate: Date | null;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
