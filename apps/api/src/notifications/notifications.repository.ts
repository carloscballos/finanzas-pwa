import { Injectable } from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
  }): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  findLatest(userId: string, take: number): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async existsSince(userId: string, type: NotificationType, since: Date): Promise<boolean> {
    const found = await this.prisma.notification.findFirst({
      where: { userId, type, createdAt: { gte: since } },
      select: { id: true },
    });
    return found !== null;
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  // userId en el where: un aviso ajeno simplemente no se encuentra (count 0).
  async markRead(userId: string, id: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return count;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async remove(userId: string, id: string): Promise<number> {
    const { count } = await this.prisma.notification.deleteMany({ where: { id, userId } });
    return count;
  }

  // Los avisos se acumulan sin límite si nadie los limpia: se borran los
  // leídos de hace más de `olderThan` al listar (ver NotificationsService).
  async removeReadOlderThan(userId: string, olderThan: Date): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { userId, readAt: { not: null }, createdAt: { lt: olderThan } },
    });
  }
}
