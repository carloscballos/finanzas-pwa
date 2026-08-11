import { Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionWithRelations } from './mappers/transaction.mapper';

const WITH_RELATIONS = {
  account: { select: { id: true, name: true, currency: true } },
  category: { select: { id: true, name: true, emoji: true, type: true } },
  createdBy: { select: { id: true, name: true } },
  transfer: {
    select: {
      fromAccount: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
    },
  },
} as const;

export interface TransactionFilters {
  userId: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
}

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<TransactionWithRelations | null> {
    return this.prisma.transaction.findUnique({ where: { id }, include: WITH_RELATIONS });
  }

  findMany(filters: TransactionFilters): Promise<TransactionWithRelations[]> {
    return this.prisma.transaction.findMany({
      where: {
        categoryId: filters.categoryId,
        type: filters.type,
        account: filters.accountId
          ? { id: filters.accountId }
          : { members: { some: { userId: filters.userId } } },
      },
      include: WITH_RELATIONS,
      orderBy: { occurredAt: 'desc' },
    });
  }

  // recurringTransactionId no es parte de CreateTransactionDto (no lo debe
  // poder fijar el cliente vía la API pública) — solo lo usa internamente
  // RecurringTransactionsService.apply() para ligar el movimiento a la
  // plantilla de la que salió.
  create(
    userId: string,
    dto: CreateTransactionDto,
    recurringTransactionId?: string,
  ): Promise<TransactionWithRelations> {
    return this.prisma.transaction.create({
      data: {
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        type: dto.type,
        amount: dto.amount,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        createdByUserId: userId,
        recurringTransactionId,
      },
      include: WITH_RELATIONS,
    });
  }

  update(id: string, dto: UpdateTransactionDto): Promise<TransactionWithRelations> {
    return this.prisma.transaction.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        type: dto.type,
        amount: dto.amount,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
      include: WITH_RELATIONS,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.transaction.delete({ where: { id } });
  }
}
