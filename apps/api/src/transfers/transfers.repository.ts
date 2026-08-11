import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransferWithRelations } from './mappers/transfer.mapper';

const WITH_RELATIONS = {
  fromAccount: { select: { id: true, name: true, currency: true } },
  toAccount: { select: { id: true, name: true, currency: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number | null;
  note?: string;
  occurredAt: Date;
}

@Injectable()
export class TransfersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<TransferWithRelations | null> {
    return this.prisma.transfer.findUnique({ where: { id }, include: WITH_RELATIONS });
  }

  findForAccount(accountId: string): Promise<TransferWithRelations[]> {
    return this.prisma.transfer.findMany({
      where: { OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] },
      include: WITH_RELATIONS,
      orderBy: { occurredAt: 'desc' },
    });
  }

  // Transacción interactiva (no el array form) porque las dos patas
  // necesitan el id de la transferencia recién creada. Mismo principio de
  // atomicidad que account-invitations.repository.ts#accept: nunca queda
  // una transferencia con una sola pata.
  async create(userId: string, input: CreateTransferInput): Promise<TransferWithRelations> {
    const transferId = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          fromAmount: input.fromAmount,
          toAmount: input.toAmount,
          exchangeRate: input.exchangeRate ?? undefined,
          note: input.note,
          occurredAt: input.occurredAt,
          createdByUserId: userId,
        },
      });

      await tx.transaction.createMany({
        data: [
          {
            accountId: input.fromAccountId,
            type: 'EXPENSE',
            amount: input.fromAmount,
            note: input.note,
            occurredAt: input.occurredAt,
            createdByUserId: userId,
            transferId: transfer.id,
          },
          {
            accountId: input.toAccountId,
            type: 'INCOME',
            amount: input.toAmount,
            note: input.note,
            occurredAt: input.occurredAt,
            createdByUserId: userId,
            transferId: transfer.id,
          },
        ],
      });

      return transfer.id;
    });

    return (await this.findById(transferId))!;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.transfer.delete({ where: { id } });
  }
}
