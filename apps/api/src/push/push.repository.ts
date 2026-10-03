import { Injectable } from '@nestjs/common';
import { PushSubscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `endpoint` es único: si el mismo navegador cambia de cuenta, la
  // suscripción pasa al usuario nuevo (un dispositivo = una persona a la vez).
  upsert(data: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }): Promise<PushSubscription> {
    const { endpoint, ...rest } = data;
    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, ...rest },
      update: rest,
    });
  }

  findByUser(userId: string): Promise<PushSubscription[]> {
    return this.prisma.pushSubscription.findMany({ where: { userId } });
  }

  async removeByEndpoint(endpoint: string, userId?: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  }

  async touch(id: string): Promise<void> {
    await this.prisma.pushSubscription.updateMany({ where: { id }, data: { lastUsedAt: new Date() } });
  }
}
