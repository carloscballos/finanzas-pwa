import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DebtPaymentStatus } from '@prisma/client';

export class DebtPaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 200 })
  amount: number;

  @ApiPropertyOptional({ example: 'Abono en efectivo' })
  note: string | null;

  @ApiProperty({ example: '2026-08-13T00:00:00.000Z' })
  occurredAt: Date;

  @ApiProperty({ enum: DebtPaymentStatus, example: DebtPaymentStatus.PENDING_CONFIRMATION })
  status: DebtPaymentStatus;

  @ApiProperty({ example: true, description: 'true si el usuario autenticado registró este abono' })
  createdByMe: boolean;

  @ApiProperty({ example: '2026-08-13T00:00:00.000Z' })
  createdAt: Date;
}
