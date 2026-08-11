import { Injectable } from '@nestjs/common';
import { DebtStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DebtWithParties } from './mappers/debt.mapper';

const WITH_PARTIES = {
  creditor: { select: { id: true, name: true, email: true } },
  debtor: { select: { id: true, name: true, email: true } },
} as const;

export interface CreateDebtRecord {
  creditorId: string;
  debtorId: string;
  createdByUserId: string;
  amount: number;
  currency?: string;
  description?: string;
}

@Injectable()
export class DebtsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<DebtWithParties[]> {
    return this.prisma.debt.findMany({
      where: { OR: [{ creditorId: userId }, { debtorId: userId }] },
      include: WITH_PARTIES,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<DebtWithParties | null> {
    return this.prisma.debt.findUnique({ where: { id }, include: WITH_PARTIES });
  }

  create(data: CreateDebtRecord): Promise<DebtWithParties> {
    return this.prisma.debt.create({ data, include: WITH_PARTIES });
  }

  setStatus(
    id: string,
    data: {
      status: DebtStatus;
      markedPaidByUserId?: string | null;
      settledAt?: Date | null;
    },
  ): Promise<DebtWithParties> {
    return this.prisma.debt.update({ where: { id }, data, include: WITH_PARTIES });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.debt.delete({ where: { id } });
  }
}
