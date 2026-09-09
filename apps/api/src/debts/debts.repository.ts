import { Injectable } from '@nestjs/common';
import { DebtPaymentStatus, DebtStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DebtWithParties } from './mappers/debt.mapper';

const WITH_PARTIES = {
  creditor: { select: { id: true, name: true, email: true } },
  debtor: { select: { id: true, name: true, email: true } },
  payments: { orderBy: { createdAt: 'desc' } },
} as const;

export interface CreateDebtRecord {
  creditorId: string;
  debtorId: string;
  createdByUserId: string;
  amount: number;
  currency?: string;
  description?: string;
}

export interface CreateDebtPaymentRecord {
  debtId: string;
  amount: number;
  note?: string;
  occurredAt: Date;
  createdByUserId: string;
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
    return this.prisma.debt.create({
      data: { ...data, remainingBalance: data.amount },
      include: WITH_PARTIES,
    });
  }

  async createPayment(data: CreateDebtPaymentRecord): Promise<void> {
    await this.prisma.debtPayment.create({ data });
  }

  // Transacción interactiva: al confirmar un abono se descuenta
  // remainingBalance y, si llega a 0, se liquida la deuda directamente — la
  // confirmación del abono ya fue el visto bueno de la otra parte, no hace
  // falta un segundo paso de confirmación a nivel de deuda.
  async resolvePayment(
    debtId: string,
    paymentId: string,
    status: DebtPaymentStatus,
    decrementAmount?: number,
  ): Promise<DebtWithParties> {
    return this.prisma.$transaction(async (tx) => {
      await tx.debtPayment.update({
        where: { id: paymentId },
        data: { status, respondedAt: new Date() },
      });

      if (status === DebtPaymentStatus.CONFIRMED && decrementAmount) {
        const debt = await tx.debt.update({
          where: { id: debtId },
          data: { remainingBalance: { decrement: decrementAmount } },
        });
        if (Number(debt.remainingBalance) <= 0) {
          await tx.debt.update({
            where: { id: debtId },
            data: { status: DebtStatus.SETTLED, settledAt: new Date(), remainingBalance: 0 },
          });
        }
      }

      return tx.debt.findUniqueOrThrow({ where: { id: debtId }, include: WITH_PARTIES });
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.debt.delete({ where: { id } });
  }
}
