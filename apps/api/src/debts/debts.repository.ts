import { Injectable } from '@nestjs/common';
import { DebtPaymentStatus, DebtStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DebtWithParties } from './mappers/debt.mapper';

const WITH_PARTIES = {
  creditor: { select: { id: true, name: true, email: true } },
  debtor: { select: { id: true, name: true, email: true } },
  payments: { orderBy: { createdAt: 'desc' } },
} as const;

export interface CreateDebtRecord {
  creditorId: string | null;
  debtorId: string | null;
  counterpartyName: string | null;
  counterpartyEmail: string | null;
  createdByUserId: string;
  amount: number;
  currency?: string;
  description?: string;
}

export interface CreateDebtPaymentRecord {
  debtId: string;
  accountId: string;
  amount: number;
  note?: string;
  occurredAt: Date;
  createdByUserId: string;
}

// Cuenta y sentido del Transaction que genera un abono al quedar confirmado
// (INCOME si quien lo registró es el acreedor, EXPENSE si es el deudor).
export interface DebtPaymentTransactionInfo {
  accountId: string;
  type: TransactionType;
  createdByUserId: string;
  occurredAt: Date;
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

  // Si `autoConfirm` viene seteado (contraparte sin cuenta en la app, nadie
  // más puede confirmar) el abono se crea ya CONFIRMED, generando de una vez
  // su Transaction y descontando remainingBalance — mismo efecto que crear +
  // confirmar, pero atómico. Si no, queda PENDING_CONFIRMATION como siempre.
  async createPayment(
    data: CreateDebtPaymentRecord,
    autoConfirm: DebtPaymentTransactionInfo | null,
  ): Promise<DebtWithParties> {
    return this.prisma.$transaction(async (tx) => {
      await tx.debtPayment.create({
        data: {
          debtId: data.debtId,
          accountId: data.accountId,
          amount: data.amount,
          note: data.note,
          occurredAt: data.occurredAt,
          createdByUserId: data.createdByUserId,
          status: autoConfirm ? DebtPaymentStatus.CONFIRMED : DebtPaymentStatus.PENDING_CONFIRMATION,
          respondedAt: autoConfirm ? new Date() : null,
        },
      });

      if (autoConfirm) {
        await tx.transaction.create({
          data: {
            accountId: autoConfirm.accountId,
            type: autoConfirm.type,
            amount: data.amount,
            occurredAt: data.occurredAt,
            createdByUserId: autoConfirm.createdByUserId,
            debtId: data.debtId,
          },
        });
        const debt = await tx.debt.update({
          where: { id: data.debtId },
          data: { remainingBalance: { decrement: data.amount } },
        });
        if (Number(debt.remainingBalance) <= 0) {
          await tx.debt.update({
            where: { id: data.debtId },
            data: { status: DebtStatus.SETTLED, settledAt: new Date(), remainingBalance: 0 },
          });
        }
      }

      return tx.debt.findUniqueOrThrow({ where: { id: data.debtId }, include: WITH_PARTIES });
    });
  }

  // Transacción interactiva: al confirmar un abono se descuenta
  // remainingBalance y, si llega a 0, se liquida la deuda directamente — la
  // confirmación del abono ya fue el visto bueno de la otra parte, no hace
  // falta un segundo paso de confirmación a nivel de deuda. `confirmTx` es
  // null en abonos de antes de esta funcionalidad (sin accountId) — para
  // esos, se confirma el estado pero no se genera un Transaction retroactivo.
  async resolvePayment(
    debtId: string,
    paymentId: string,
    status: DebtPaymentStatus,
    decrementAmount?: number,
    confirmTx?: DebtPaymentTransactionInfo | null,
  ): Promise<DebtWithParties> {
    return this.prisma.$transaction(async (tx) => {
      await tx.debtPayment.update({
        where: { id: paymentId },
        data: { status, respondedAt: new Date() },
      });

      if (status === DebtPaymentStatus.CONFIRMED && decrementAmount) {
        if (confirmTx) {
          await tx.transaction.create({
            data: {
              accountId: confirmTx.accountId,
              type: confirmTx.type,
              amount: decrementAmount,
              occurredAt: confirmTx.occurredAt,
              createdByUserId: confirmTx.createdByUserId,
              debtId,
            },
          });
        }
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
