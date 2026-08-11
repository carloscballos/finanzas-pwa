import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { RecurringTransactionWithRelations } from './mappers/recurring-transaction.mapper';

const WITH_RELATIONS = {
  account: { select: { id: true, name: true, currency: true } },
  category: { select: { id: true, name: true, emoji: true, type: true } },
} as const;

@Injectable()
export class RecurringTransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<RecurringTransactionWithRelations[]> {
    return this.prisma.recurringTransaction.findMany({
      where: { account: { members: { some: { userId } } } },
      include: WITH_RELATIONS,
      orderBy: { nextRunDate: 'asc' },
    });
  }

  findById(id: string): Promise<RecurringTransactionWithRelations | null> {
    return this.prisma.recurringTransaction.findUnique({ where: { id }, include: WITH_RELATIONS });
  }

  create(
    userId: string,
    dto: CreateRecurringTransactionDto,
  ): Promise<RecurringTransactionWithRelations> {
    return this.prisma.recurringTransaction.create({
      data: {
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        createdByUserId: userId,
        type: dto.type,
        amount: dto.amount,
        note: dto.note,
        frequency: dto.frequency,
        startDate: new Date(dto.startDate),
        nextRunDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: WITH_RELATIONS,
    });
  }

  update(id: string, dto: UpdateRecurringTransactionDto): Promise<RecurringTransactionWithRelations> {
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        amount: dto.amount,
        note: dto.note,
        active: dto.active,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: WITH_RELATIONS,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.recurringTransaction.delete({ where: { id } });
  }

  // Usado por el scheduler: todas las plantillas activas con al menos una
  // ocurrencia vencida (nextRunDate <= asOf), sin filtrar por usuario. El
  // service compara cada ocurrencia contra endDate dentro del loop de
  // generación (no aquí), para no saltarse la última ocurrencia válida.
  findDue(asOf: Date): Promise<RecurringTransactionWithRelations[]> {
    return this.prisma.recurringTransaction.findMany({
      where: { active: true, nextRunDate: { lte: asOf } },
      include: WITH_RELATIONS,
    });
  }

  // Crea las transacciones vencidas y avanza la plantilla en una sola
  // transacción de BD: nunca queda desalineado (generar sin avanzar
  // duplicaría movimientos en la próxima corrida; avanzar sin generar
  // perdería la ocurrencia).
  async generateOccurrences(
    item: RecurringTransactionWithRelations,
    occurredAtDates: Date[],
    nextRunDate: Date,
    active: boolean,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.transaction.createMany({
        data: occurredAtDates.map((occurredAt) => ({
          accountId: item.accountId,
          categoryId: item.categoryId,
          createdByUserId: item.createdByUserId,
          type: item.type,
          amount: item.amount,
          note: item.note,
          occurredAt,
          recurringTransactionId: item.id,
        })),
      }),
      this.prisma.recurringTransaction.update({
        where: { id: item.id },
        data: { nextRunDate, lastRunAt: new Date(), active },
      }),
    ]);
  }
}
