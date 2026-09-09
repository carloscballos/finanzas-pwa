import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DebtStatus } from '@prisma/client';
import { DebtDirection } from './create-debt.dto';
import { DebtPaymentResponseDto } from './debt-payment-response.dto';

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

  @ApiProperty({ example: 200, description: 'Lo que sigue pendiente hoy — baja con cada abono confirmado' })
  remainingBalance: number;

  @ApiProperty({ example: 60 })
  percentPaid: number;

  @ApiProperty({ example: 'MXN' })
  currency: string;

  @ApiPropertyOptional({ example: 'Cena del viernes' })
  description: string | null;

  @ApiProperty({ enum: DebtStatus, example: DebtStatus.PENDING })
  status: DebtStatus;

  @ApiProperty({ example: true, description: 'true si el usuario autenticado la creó (puede eliminarla)' })
  createdByMe: boolean;

  @ApiProperty({ type: [DebtPaymentResponseDto], description: 'Historial de abonos, más reciente primero' })
  payments: DebtPaymentResponseDto[];

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: '2026-08-10T16:00:00.000Z' })
  settledAt: Date | null;
}
