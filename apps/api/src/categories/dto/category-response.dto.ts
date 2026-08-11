import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class CategoryResponseDto {
  @ApiProperty({ example: 'a3f1c2b0-9e4d-4b1a-8f3c-1d2e3f4a5b6c' })
  id: string;

  @ApiProperty({ example: 'Comida' })
  name: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type: TransactionType;

  @ApiPropertyOptional({ example: '🍔' })
  emoji: string | null;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
