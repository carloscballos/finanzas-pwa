import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FriendRequestStatus } from '@prisma/client';

class FriendRequestUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Beto Ruiz' })
  name: string;

  @ApiProperty({ example: 'beto@example.com' })
  email: string;
}

export class FriendRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: FriendRequestUserSummaryDto })
  requestedBy: FriendRequestUserSummaryDto;

  @ApiProperty({ type: FriendRequestUserSummaryDto })
  requestedTo: FriendRequestUserSummaryDto;

  @ApiProperty({ enum: FriendRequestStatus, example: FriendRequestStatus.PENDING })
  status: FriendRequestStatus;

  @ApiProperty({ example: '2026-08-10T16:00:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: '2026-08-10T16:00:00.000Z' })
  respondedAt: Date | null;
}
