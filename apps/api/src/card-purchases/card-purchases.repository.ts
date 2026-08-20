import { Injectable } from '@nestjs/common';
import { CardPurchaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CardPurchaseWithAccount } from './mappers/card-purchase.mapper';

const WITH_ACCOUNT = { account: { select: { id: true, name: true, currency: true } } } as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface CreateCardPurchaseRecord {
  userId: string;
  accountId: string;
  merchant: string;
  amount: number;
  remainingBalance: number;
  installmentsTotal: number;
  installmentsPaid: number;
  installmentAmount: number;
  interestRate?: number;
  lastStatementInterestAmount?: number;
  purchasedAt: Date;
  status: CardPurchaseStatus;
  bookTransaction: boolean;
}

export interface UpdateCardPurchaseRecord {
  merchant?: string;
  interestRate?: number;
  installmentAmount?: number;
  remainingBalance?: number;
  status?: CardPurchaseStatus;
  lastStatementInterestAmount?: number;
}

export interface RegisterInstallmentPaymentInput {
  cardPurchaseId: string;
  cardAccountId: string;
  payingAccountId: string;
  userId: string;
  // Capital de esta cuota — es lo único que reduce remainingBalance y lo
  // único que se acredita en la tarjeta (INCOME). El interés (si lo hay) se
  // descuenta de la cuenta que paga pero no llega a la tarjeta, porque el
  // banco lo cobra aparte y nunca se contabilizó como deuda de la compra.
  capitalAmount: number;
  interestAmount: number;
  occurredAt: Date;
  remainingBalance: number;
  status: CardPurchaseStatus;
}

export interface MonthlyInstallmentUpdate {
  cardPurchaseId: string;
  remainingBalance: number;
  status: CardPurchaseStatus;
}

export interface RegisterMonthlyPaymentInput {
  payingAccountId: string;
  cardAccountId: string;
  userId: string;
  // paidAmount es lo que sale de la cuenta que paga (capital + interés si
  // aplica); capitalAmount es lo que de verdad se acredita en la tarjeta —
  // la suma del capital de cada cuota, nunca el interés.
  paidAmount: number;
  capitalAmount: number;
  occurredAt: Date;
  note: string;
  installments: MonthlyInstallmentUpdate[];
}

@Injectable()
export class CardPurchasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<CardPurchaseWithAccount[]> {
    return this.prisma.cardPurchase.findMany({
      where: { userId },
      include: WITH_ACCOUNT,
      orderBy: { purchasedAt: 'desc' },
    });
  }

  findForAccount(accountId: string): Promise<CardPurchaseWithAccount[]> {
    return this.prisma.cardPurchase.findMany({
      where: { accountId },
      include: WITH_ACCOUNT,
      orderBy: { purchasedAt: 'desc' },
    });
  }

  findById(id: string): Promise<CardPurchaseWithAccount | null> {
    return this.prisma.cardPurchase.findUnique({ where: { id }, include: WITH_ACCOUNT });
  }

  // Transacción interactiva: crea la compra y, si queda algo pendiente Y
  // bookTransaction es true, el EXPENSE inicial en la tarjeta por ese saldo
  // (no por el monto total, para no contabilizar de más al importar una
  // compra que ya traía cuotas pagadas) — mismo principio que
  // GoalsRepository.addContribution. bookTransaction en false es para
  // cuando esa deuda ya estaba reflejada en el saldo de la cuenta por otro
  // lado (ej. el saldo inicial al crearla) y solo se quiere el historial.
  async create(data: CreateCardPurchaseRecord): Promise<CardPurchaseWithAccount> {
    const id = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.cardPurchase.create({
        data: {
          userId: data.userId,
          accountId: data.accountId,
          merchant: data.merchant,
          amount: data.amount,
          remainingBalance: data.remainingBalance,
          installmentsTotal: data.installmentsTotal,
          installmentsPaid: data.installmentsPaid,
          installmentAmount: data.installmentAmount,
          interestRate: data.interestRate,
          lastStatementInterestAmount: data.lastStatementInterestAmount,
          purchasedAt: data.purchasedAt,
          status: data.status,
        },
      });

      if (data.remainingBalance > 0 && data.bookTransaction) {
        await tx.transaction.create({
          data: {
            accountId: data.accountId,
            type: 'EXPENSE',
            amount: data.remainingBalance,
            occurredAt: data.purchasedAt,
            createdByUserId: data.userId,
            cardPurchaseId: purchase.id,
          },
        });
      }

      return purchase.id;
    });

    return (await this.findById(id))!;
  }

  update(id: string, data: UpdateCardPurchaseRecord): Promise<CardPurchaseWithAccount> {
    return this.prisma.cardPurchase.update({
      where: { id },
      data,
      include: WITH_ACCOUNT,
    });
  }

  // Pagar una cuota mueve dinero real: EXPENSE en la cuenta que paga, INCOME
  // en la tarjeta (esa parte de la deuda queda saldada) — como un Transfer,
  // pero con montos distintos si hay interés: la cuenta que paga pierde
  // capital+interés, la tarjeta solo se acredita el capital.
  async registerInstallmentPayment(
    input: RegisterInstallmentPaymentInput,
  ): Promise<CardPurchaseWithAccount> {
    const paidAmount = round2(input.capitalAmount + input.interestAmount);
    const id = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.createMany({
        data: [
          {
            accountId: input.payingAccountId,
            type: 'EXPENSE',
            amount: paidAmount,
            occurredAt: input.occurredAt,
            createdByUserId: input.userId,
            cardPurchaseId: input.cardPurchaseId,
          },
          {
            accountId: input.cardAccountId,
            type: 'INCOME',
            amount: input.capitalAmount,
            occurredAt: input.occurredAt,
            createdByUserId: input.userId,
            cardPurchaseId: input.cardPurchaseId,
          },
        ],
      });

      const purchase = await tx.cardPurchase.update({
        where: { id: input.cardPurchaseId },
        data: {
          remainingBalance: input.remainingBalance,
          installmentsPaid: { increment: 1 },
          status: input.status,
          // Consumido: ya se usó (o no había) para esta cuota. La próxima
          // solo tiene un valor real si se importa/concilia un extracto
          // nuevo — mientras tanto, el pago cae de vuelta al estimado.
          lastStatementInterestAmount: null,
        },
      });
      return purchase.id;
    });

    return (await this.findById(id))!;
  }

  // Un solo movimiento (como una Transfer real: dos Transaction con
  // transferId compartido) por todas las cuotas del mes, en vez de un par
  // de Transaction por cada compra — así el extracto bancario real (un solo
  // cargo) se refleja igual en la app, visible en los movimientos de ambas
  // cuentas. El avance de cada compra (installmentsPaid/remainingBalance) se
  // sigue aplicando individual y atómicamente en la misma transacción de BD.
  async registerMonthlyPayment(input: RegisterMonthlyPaymentInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // fromAmount/toAmount distintos — el mismo campo que la app ya usa
      // para transferencias con conversión de moneda, reutilizado aquí para
      // que la cuenta que paga pierda el total real (con interés) mientras
      // la tarjeta solo se acredita el capital de las cuotas.
      const transfer = await tx.transfer.create({
        data: {
          fromAccountId: input.payingAccountId,
          toAccountId: input.cardAccountId,
          fromAmount: input.paidAmount,
          toAmount: input.capitalAmount,
          note: input.note,
          occurredAt: input.occurredAt,
          createdByUserId: input.userId,
        },
      });

      await tx.transaction.createMany({
        data: [
          {
            accountId: input.payingAccountId,
            type: 'EXPENSE',
            amount: input.paidAmount,
            note: input.note,
            occurredAt: input.occurredAt,
            createdByUserId: input.userId,
            transferId: transfer.id,
          },
          {
            accountId: input.cardAccountId,
            type: 'INCOME',
            amount: input.capitalAmount,
            note: input.note,
            occurredAt: input.occurredAt,
            createdByUserId: input.userId,
            transferId: transfer.id,
          },
        ],
      });

      for (const installment of input.installments) {
        await tx.cardPurchase.update({
          where: { id: installment.cardPurchaseId },
          data: {
            remainingBalance: installment.remainingBalance,
            installmentsPaid: { increment: 1 },
            status: installment.status,
            lastStatementInterestAmount: null,
          },
        });
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.cardPurchase.delete({ where: { id } });
  }
}
