import { Injectable } from '@nestjs/common';
import { CardPurchaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCardPurchaseDto } from './dto/update-card-purchase.dto';
import { CardPurchaseWithAccount } from './mappers/card-purchase.mapper';

const WITH_ACCOUNT = { account: { select: { id: true, name: true, currency: true } } } as const;

export interface CreateCardPurchaseRecord {
  userId: string;
  accountId: string;
  merchant: string;
  amount: number;
  remainingBalance: number;
  installmentsTotal: number;
  installmentsPaid: number;
  installmentAmount: number;
  purchasedAt: Date;
  status: CardPurchaseStatus;
}

export interface RegisterInstallmentPaymentInput {
  cardPurchaseId: string;
  cardAccountId: string;
  payingAccountId: string;
  userId: string;
  amount: number;
  occurredAt: Date;
  remainingBalance: number;
  status: CardPurchaseStatus;
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

  // Transacción interactiva: crea la compra y, si queda algo pendiente, el
  // EXPENSE inicial en la tarjeta por ese saldo (no por el monto total, para
  // no contabilizar de más al importar una compra que ya traía cuotas
  // pagadas) — mismo principio que GoalsRepository.addContribution.
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
          purchasedAt: data.purchasedAt,
          status: data.status,
        },
      });

      if (data.remainingBalance > 0) {
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

  update(id: string, dto: UpdateCardPurchaseDto): Promise<CardPurchaseWithAccount> {
    return this.prisma.cardPurchase.update({
      where: { id },
      data: { merchant: dto.merchant },
      include: WITH_ACCOUNT,
    });
  }

  // Pagar una cuota mueve dinero real: EXPENSE en la cuenta que paga, INCOME
  // en la tarjeta (esa parte de la deuda queda saldada) — como un Transfer.
  async registerInstallmentPayment(
    input: RegisterInstallmentPaymentInput,
  ): Promise<CardPurchaseWithAccount> {
    const id = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.createMany({
        data: [
          {
            accountId: input.payingAccountId,
            type: 'EXPENSE',
            amount: input.amount,
            occurredAt: input.occurredAt,
            createdByUserId: input.userId,
            cardPurchaseId: input.cardPurchaseId,
          },
          {
            accountId: input.cardAccountId,
            type: 'INCOME',
            amount: input.amount,
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
        },
      });
      return purchase.id;
    });

    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.cardPurchase.delete({ where: { id } });
  }
}
