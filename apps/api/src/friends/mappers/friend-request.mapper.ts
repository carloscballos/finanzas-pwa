import { FriendRequest } from '@prisma/client';
import { FriendRequestResponseDto } from '../dto/friend-request-response.dto';
import { FriendResponseDto } from '../dto/friend-response.dto';

type UserSummary = { id: string; name: string; email: string };

export type FriendRequestWithRelations = FriendRequest & {
  requestedBy: UserSummary;
  requestedTo: UserSummary;
};

export class FriendRequestMapper {
  static toResponse(request: FriendRequestWithRelations): FriendRequestResponseDto {
    return {
      id: request.id,
      requestedBy: request.requestedBy,
      requestedTo: request.requestedTo,
      status: request.status,
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
    };
  }

  static toResponseList(requests: FriendRequestWithRelations[]): FriendRequestResponseDto[] {
    return requests.map(FriendRequestMapper.toResponse);
  }

  static toFriend(counterparty: UserSummary): FriendResponseDto {
    return counterparty;
  }
}
