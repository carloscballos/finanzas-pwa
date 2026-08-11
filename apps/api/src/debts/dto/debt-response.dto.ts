import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DebtStatus } from '@prisma/client';
import { DebtDirection } from './create-debt.dto';

class DebtCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Beto Ruiz' })
  name: string;

  @ApiProperty({ example: 'beto@example.com' })
  email: string;
}

export class DebtResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: DebtCounterpartyDto })
  counterparty: DebtCounterpartyDto;

  @ApiProperty({
    enum: DebtDirection,
    example: DebtDirection.THEY_OWE_ME,
    description: 'Desde la perspectiva del usuario autenticado',
  })
  direction: DebtDirection;

  @ApiProperty({ example: 500 })
  amount: number;

  @ApiProperty({ example: 'MXN' })
  currency: string;

  @ApiPropertyOptional({ example: 'Cena del viernes' })
  description: string | null;

  @ApiProperty({ enum: DebtStatus, example: DebtStatus.PENDING })
  status: DebtStatus;

  @ApiProperty({
    example: false,
    description: 'true si el usuario autenticado fue quien la marcó como pagada',
  })
  markedPaidByMe: boolean;

  @ApiProperty({ example: true, description: 'true si el usuario autenticado la creó (puede eliminarla)' })
  createdByMe: boolean;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: '2026-08-10T16:00:00.000Z' })
  settledAt: Date | null;
}
