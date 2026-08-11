import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationWithRelations } from './mappers/invitation.mapper';

const WITH_RELATIONS = {
  account: { select: { id: true, name: true } },
  invitedUser: { select: { id: true, name: true, email: true } },
  invitedBy: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class AccountInvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<InvitationWithRelations | null> {
    return this.prisma.accountInvitation.findUnique({ where: { id }, include: WITH_RELATIONS });
  }

  findMine(userId: string): Promise<InvitationWithRelations[]> {
    return this.prisma.accountInvitation.findMany({
      where: { invitedUserId: userId },
      include: WITH_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  findForAccount(accountId: string): Promise<InvitationWithRelations[]> {
    return this.prisma.accountInvitation.findMany({
      where: { accountId },
      include: WITH_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  findPending(accountId: string, invitedUserId: string): Promise<InvitationWithRelations | null> {
    return this.prisma.accountInvitation.findFirst({
      where: { accountId, invitedUserId, status: 'PENDING' },
      include: WITH_RELATIONS,
    });
  }

  create(data: {
    accountId: string;
    invitedUserId: string;
    invitedByUserId: string;
  }): Promise<InvitationWithRelations> {
    return this.prisma.accountInvitation.create({ data, include: WITH_RELATIONS });
  }

  updateStatus(
    id: string,
    status: 'DECLINED' | 'CANCELED',
  ): Promise<InvitationWithRelations> {
    return this.prisma.accountInvitation.update({
      where: { id },
      data: { status, respondedAt: new Date() },
      include: WITH_RELATIONS,
    });
  }

  // Atómico: crear la membresía y marcar la invitación como aceptada juntas.
  async accept(invitation: InvitationWithRelations): Promise<InvitationWithRelations> {
    const [, updated] = await this.prisma.$transaction([
      this.prisma.accountMember.create({
        data: { accountId: invitation.accountId, userId: invitation.invitedUserId, role: 'MEMBER' },
      }),
      this.prisma.accountInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
        include: WITH_RELATIONS,
      }),
    ]);
    return updated;
  }
}
