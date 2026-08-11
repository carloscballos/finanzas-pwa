import { AccountInvitation } from '@prisma/client';
import { InvitationResponseDto } from '../dto/invitation-response.dto';

type UserSummary = { id: string; name: string; email: string };

export type InvitationWithRelations = AccountInvitation & {
  account: { id: string; name: string };
  invitedUser: UserSummary;
  invitedBy: UserSummary;
};

export class InvitationMapper {
  static toResponse(invitation: InvitationWithRelations): InvitationResponseDto {
    return {
      id: invitation.id,
      account: invitation.account,
      invitedUser: invitation.invitedUser,
      invitedBy: invitation.invitedBy,
      status: invitation.status,
      createdAt: invitation.createdAt,
      respondedAt: invitation.respondedAt,
    };
  }

  static toResponseList(invitations: InvitationWithRelations[]): InvitationResponseDto[] {
    return invitations.map(InvitationMapper.toResponse);
  }
}
