import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountInvitationStatus } from '@prisma/client';

class InvitationAccountSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ahorros compartidos' })
  name: string;
}

class InvitationUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Beto Ruiz' })
  name: string;

  @ApiProperty({ example: 'beto@example.com' })
  email: string;
}

export class InvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: InvitationAccountSummaryDto })
  account: InvitationAccountSummaryDto;

  @ApiProperty({ type: InvitationUserSummaryDto })
  invitedUser: InvitationUserSummaryDto;

  @ApiProperty({ type: InvitationUserSummaryDto })
  invitedBy: InvitationUserSummaryDto;

  @ApiProperty({ enum: AccountInvitationStatus, example: AccountInvitationStatus.PENDING })
  status: AccountInvitationStatus;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: '2026-08-10T16:00:00.000Z' })
  respondedAt: Date | null;
}
