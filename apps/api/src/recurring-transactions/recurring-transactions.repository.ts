import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { RecurringTransactionWithRelations } from './mappers/recurring-transaction.mapper';

const WITH_RELATIONS = {
  account: { select: { id: true, name: true, currency: true } },
  category: { select: { id: true, name: true, emoji: true, type: true } },
} as const;

// Calendario de ejecución automática (fechas de calendario, ver colombia-time.ts).
export interface AutoSchedule {
  autoApply: boolean;
  scheduleStart: Date | null;
  nextRunOn: Date | null;
}

@Injectable()
export class RecurringTransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<RecurringTransactionWithRelations[]> {
    return this.prisma.recurringTransaction.findMany({
      where: { account: { members: { some: { userId } } } },
      include: WITH_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<RecurringTransactionWithRelations | null> {
    return this.prisma.recurringTransaction.findUnique({ where: { id }, include: WITH_RELATIONS });
  }

  // Plantillas automáticas a las que ya les toca (o les tocó y no se pudo).
  findDue(today: Date): Promise<RecurringTransactionWithRelations[]> {
    return this.prisma.recurringTransaction.findMany({
      where: { autoApply: true, active: true, nextRunOn: { lte: today } },
      include: WITH_RELATIONS,
      orderBy: { nextRunOn: 'asc' },
    });
  }

  create(
    userId: string,
    dto: CreateRecurringTransactionDto,
    schedule: AutoSchedule,
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
        ...schedule,
      },
      include: WITH_RELATIONS,
    });
  }

  update(
    id: string,
    dto: UpdateRecurringTransactionDto,
    schedule?: AutoSchedule,
  ): Promise<RecurringTransactionWithRelations> {
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        amount: dto.amount,
        note: dto.note,
        active: dto.active,
        ...schedule,
        // Un calendario nuevo (o apagado) empieza sin avisos de fallo previos.
        ...(schedule ? { failureNotifiedFor: null } : {}),
      },
      include: WITH_RELATIONS,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.recurringTransaction.delete({ where: { id } });
  }

  async markApplied(id: string): Promise<void> {
    await this.prisma.recurringTransaction.update({
      where: { id },
      data: { lastAppliedAt: new Date() },
    });
  }

  // Aplicación manual de una plantilla automática a la que ya le tocaba: se
  // adelanta el calendario para que el cron no la registre otra vez.
  async markAppliedAndAdvance(id: string, nextRunOn: Date): Promise<void> {
    await this.prisma.recurringTransaction.update({
      where: { id },
      data: { lastAppliedAt: new Date(), nextRunOn, failureNotifiedFor: null },
    });
  }

  // Reclama la ejecución de `dueOn` y crea el movimiento en UNA transacción de
  // BD. El reclamo es un UPDATE condicionado a que nextRunOn siga siendo
  // `dueOn`: si otro proceso (o una corrida repetida del cron) ya la aplicó,
  // el UPDATE no toca ninguna fila y se devuelve null sin crear nada — así un
  // reinicio o dos réplicas nunca duplican un salario. Devuelve el id del
  // movimiento creado.
  claimAndCreateTransaction(
    item: RecurringTransactionWithRelations,
    dueOn: Date,
    nextRunOn: Date,
    occurredAt: Date,
  ): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.recurringTransaction.updateMany({
        where: { id: item.id, autoApply: true, nextRunOn: dueOn },
        data: { nextRunOn, lastAppliedAt: new Date(), failureNotifiedFor: null },
      });
      if (count === 0) return null;

      const created = await tx.transaction.create({
        data: {
          accountId: item.accountId,
          categoryId: item.categoryId,
          type: item.type,
          amount: item.amount,
          note: item.note,
          occurredAt,
          createdByUserId: item.createdByUserId,
          recurringTransactionId: item.id,
        },
        select: { id: true },
      });
      return created.id;
    });
  }

  async markFailureNotified(id: string, dueOn: Date): Promise<void> {
    await this.prisma.recurringTransaction.update({
      where: { id },
      data: { failureNotifiedFor: dueOn },
    });
  }
}
