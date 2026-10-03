import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return users.map((user) => user.id);
  }

  // Movimientos que la persona registró ella misma en ese rango. No cuentan los
  // automáticos (recurrentes) ni los pendientes del Shortcut: no son "hoy
  // anoté mis gastos".
  countRegisteredBetween(userId: string, from: Date, to: Date): Promise<number> {
    return this.prisma.transaction.count({
      where: {
        createdByUserId: userId,
        status: 'CONFIRMED',
        recurringTransactionId: null,
        createdAt: { gte: from, lt: to },
      },
    });
  }

  // Pagos del Shortcut de Wallet esperando que la persona los confirme.
  countPending(userId: string): Promise<number> {
    return this.prisma.transaction.count({ where: { createdByUserId: userId, status: 'PENDING' } });
  }
}
