import { ApiProperty } from '@nestjs/swagger';
import { AccountMemberRole, AccountType } from '@prisma/client';

export class AccountMemberSummaryDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'Beto Ruiz' })
  name: string;

  @ApiProperty({ example: 'beto@example.com' })
  email: string;

  @ApiProperty({ enum: AccountMemberRole, example: AccountMemberRole.MEMBER })
  role: AccountMemberRole;
}

export class AccountResponseDto {
  @ApiProperty({ example: 'a3f1c2b0-9e4d-4b1a-8f3c-1d2e3f4a5b6c' })
  id: string;

  @ApiProperty({ example: 'Ahorros Banorte' })
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.SAVINGS })
  type: AccountType;

  @ApiProperty({ example: 'MXN' })
  currency: string;

  @ApiProperty({ example: 1500.5 })
  initialBalance: number;

  @ApiProperty({
    example: 1720.5,
    description: 'initialBalance + ingresos − gastos registrados en la cuenta',
  })
  currentBalance: number;

  @ApiProperty({
    enum: AccountMemberRole,
    example: AccountMemberRole.OWNER,
    description: 'Rol del usuario autenticado dentro de esta cuenta',
  })
  role: AccountMemberRole;

  @ApiProperty({ example: 1, description: 'Cantidad de miembros con acceso a la cuenta' })
  memberCount: number;

  @ApiProperty({ type: [AccountMemberSummaryDto] })
  members: AccountMemberSummaryDto[];

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  updatedAt: Date;
}
