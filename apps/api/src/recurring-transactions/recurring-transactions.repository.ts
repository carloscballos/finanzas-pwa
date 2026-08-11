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
      orderBy: { createdAt: 'desc' },
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
}
