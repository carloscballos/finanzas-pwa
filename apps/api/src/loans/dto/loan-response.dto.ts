import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus } from '@prisma/client';

class LoanAccountSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Bbva Nomina' })
  name: string;
}

export class LoanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Préstamo carro' })
  name: string;

  @ApiProperty({ example: 20000000 })
  principal: number;

  @ApiProperty({ example: 15200000 })
  remainingBalance: number;

  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiPropertyOptional({ example: 1.5 })
  interestRate: number | null;

  @ApiProperty({ example: 24 })
  installmentsTotal: number;

  @ApiProperty({ example: 5 })
  installmentsPaid: number;

  @ApiProperty({ example: 950000 })
  installmentAmount: number;

  @ApiPropertyOptional({ example: 5 })
  dueDay: number | null;

  @ApiPropertyOptional({ type: LoanAccountSummaryDto })
  account: LoanAccountSummaryDto | null;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.ACTIVE })
  status: LoanStatus;

  @ApiProperty({ example: 24, description: 'Porcentaje del principal ya pagado (0-100)' })
  percentPaid: number;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
