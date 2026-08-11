import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendRequestWithRelations } from './mappers/friend-request.mapper';

const WITH_RELATIONS = {
  requestedBy: { select: { id: true, name: true, email: true } },
  requestedTo: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class FriendsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<FriendRequestWithRelations | null> {
    return this.prisma.friendRequest.findUnique({ where: { id }, include: WITH_RELATIONS });
  }

  findReceived(userId: string, status?: 'PENDING'): Promise<FriendRequestWithRelations[]> {
    return this.prisma.friendRequest.findMany({
      where: { requestedToUserId: userId, status },
      include: WITH_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  findSent(userId: string, status?: 'PENDING'): Promise<FriendRequestWithRelations[]> {
    return this.prisma.friendRequest.findMany({
      where: { requestedByUserId: userId, status },
      include: WITH_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Amigos = solicitudes ACCEPTED donde el usuario participa, en cualquier
  // dirección — no hay una tabla de amistad separada.
  findAccepted(userId: string): Promise<FriendRequestWithRelations[]> {
    return this.prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requestedByUserId: userId }, { requestedToUserId: userId }],
      },
      include: WITH_RELATIONS,
    });
  }

  // Cualquier solicitud viva (PENDING o ACCEPTED) entre los dos, en
  // cualquier dirección — usado para evitar duplicados y para el unfriend.
  findBetween(userId: string, otherUserId: string): Promise<FriendRequestWithRelations | null> {
    return this.prisma.friendRequest.findFirst({
      where: {
        status: { in: ['PENDING', 'ACCEPTED'] },
        OR: [
          { requestedByUserId: userId, requestedToUserId: otherUserId },
          { requestedByUserId: otherUserId, requestedToUserId: userId },
        ],
      },
      include: WITH_RELATIONS,
    });
  }

  create(requestedByUserId: string, requestedToUserId: string): Promise<FriendRequestWithRelations> {
    return this.prisma.friendRequest.create({
      data: { requestedByUserId, requestedToUserId },
      include: WITH_RELATIONS,
    });
  }

  updateStatus(
    id: string,
    status: 'ACCEPTED' | 'DECLINED' | 'CANCELED',
  ): Promise<FriendRequestWithRelations> {
    return this.prisma.friendRequest.update({
      where: { id },
      data: { status, respondedAt: new Date() },
      include: WITH_RELATIONS,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.friendRequest.delete({ where: { id } });
  }

  // Usado por UsersService.search() para marcar isFriend en los resultados,
  // sin depender de FriendsService (evita un ciclo de proveedores).
  async listFriendUserIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requestedByUserId: userId }, { requestedToUserId: userId }],
      },
      select: { requestedByUserId: true, requestedToUserId: true },
    });
    return new Set(
      rows.map((r) => (r.requestedByUserId === userId ? r.requestedToUserId : r.requestedByUserId)),
    );
  }
}
