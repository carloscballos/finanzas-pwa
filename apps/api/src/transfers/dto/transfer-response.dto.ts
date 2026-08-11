import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TransferAccountSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Bbva Nomina' })
  name: string;

  @ApiProperty({ example: 'COP' })
  currency: string;
}

class TransferCreatedBySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Carla' })
  name: string;
}

export class TransferResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: TransferAccountSummaryDto })
  fromAccount: TransferAccountSummaryDto;

  @ApiProperty({ type: TransferAccountSummaryDto })
  toAccount: TransferAccountSummaryDto;

  @ApiProperty({ example: 100000 })
  fromAmount: number;

  @ApiProperty({ example: 25.6 })
  toAmount: number;

  @ApiPropertyOptional({ example: 3900.5 })
  exchangeRate: number | null;

  @ApiPropertyOptional({ example: 'Ahorro del mes' })
  note: string | null;

  @ApiProperty({ example: '2026-08-11T18:00:00.000Z' })
  occurredAt: Date;

  @ApiProperty({ type: TransferCreatedBySummaryDto })
  createdBy: TransferCreatedBySummaryDto;

  @ApiProperty({ example: '2026-08-11T18:00:00.000Z' })
  createdAt: Date;
}
