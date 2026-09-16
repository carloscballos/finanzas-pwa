import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus } from '@prisma/client';

class LoanAccountSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Bbva Nomina' })
  name: string;
}

export class LoanInstallmentSplitDto {
  @ApiProperty({ example: 180081.21, description: 'Interés del período: saldo de capital × tasa mensual' })
  interest: number;

  @ApiProperty({ example: 102026.49, description: 'Abono a capital (lo único que baja el saldo)' })
  principal: number;

  @ApiProperty({ example: 11653, description: 'Seguro / cargos fijos' })
  insurance: number;

  @ApiProperty({ example: 293760.7, description: 'Total a pagar' })
  total: number;
}

export class LoanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Préstamo carro' })
  name: string;

  @ApiProperty({ example: 11107219.17, description: 'Monto original desembolsado' })
  principal: number;

  @ApiProperty({ example: 9633016.27, description: 'Saldo de capital pendiente' })
  remainingBalance: number;

  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiPropertyOptional({ example: 24.88, description: 'Tasa efectiva anual (%)' })
  interestRate: number | null;

  @ApiProperty({ example: 1.8688, description: 'Tasa mensual equivalente (%), derivada de interestRate' })
  monthlyRate: number;

  @ApiProperty({ example: 72 })
  installmentsTotal: number;

  @ApiProperty({ example: 17 })
  installmentsPaid: number;

  @ApiProperty({ example: 294257.61, description: 'Valor total de la cuota (capital + interés + seguro)' })
  installmentAmount: number;

  @ApiPropertyOptional({ example: 11767, description: 'Seguro / cargos fijos por cuota' })
  insuranceAmount: number | null;

  @ApiPropertyOptional({
    type: LoanInstallmentSplitDto,
    description: 'Reparto estimado de la próxima cuota según el saldo actual — null si ya está pagado',
  })
  nextInstallment: LoanInstallmentSplitDto | null;

  @ApiPropertyOptional({ example: 11 })
  dueDay: number | null;

  @ApiPropertyOptional({ type: LoanAccountSummaryDto })
  account: LoanAccountSummaryDto | null;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.ACTIVE })
  status: LoanStatus;

  @ApiProperty({ example: 13, description: 'Porcentaje del capital ya pagado (0-100)' })
  percentPaid: number;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
