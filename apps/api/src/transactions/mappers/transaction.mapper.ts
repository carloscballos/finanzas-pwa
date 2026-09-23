import { Transaction, TransactionType, TransactionStatus } from '@prisma/client';
import { TransactionResponseDto } from '../dto/transaction-response.dto';

export type TransactionWithRelations = Transaction & {
  account: { id: string; name: string; currency: string };
  category: { id: string; name: string; emoji: string | null; type: TransactionType } | null;
  createdBy: { id: string; name: string };
  transfer: {
    fromAccount: { id: string; name: string };
    toAccount: { id: string; name: string };
  } | null;
  goal: { id: string; name: string } | null;
  loan: { id: string; name: string } | null;
  cardPurchase: { id: string; merchant: string } | null;
  debt: {
    id: string;
    counterpartyName: string | null;
    creditorId: string | null;
    creditor: { name: string } | null;
    debtor: { name: string } | null;
  } | null;
};

export class TransactionMapper {
  static toResponse(transaction: TransactionWithRelations): TransactionResponseDto {
    return {
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      note: transaction.note,
      occurredAt: transaction.occurredAt,
      status: transaction.status,
      account: transaction.account,
      category: transaction.category,
      createdByUserId: transaction.createdByUserId,
      createdBy: transaction.createdBy,
      transferId: transaction.transferId,
      // La "contraparte" de una pata de transferencia es la otra cuenta: si
      // esta pata es el EXPENSE (salida), la contraparte es toAccount; si es
      // el INCOME (entrada), la contraparte es fromAccount.
      transferCounterpartyAccount: transaction.transfer
        ? transaction.type === 'EXPENSE'
          ? transaction.transfer.toAccount
          : transaction.transfer.fromAccount
        : null,
      goalId: transaction.goalId,
      goal: transaction.goal,
      loanId: transaction.loanId,
      loan: transaction.loan,
      cardPurchaseId: transaction.cardPurchaseId,
      cardPurchase: transaction.cardPurchase,
      debtId: transaction.debtId,
      // La contraparte de una transacción de deuda es siempre relativa a
      // quien la registró (transaction.createdByUserId) — esta Transaction
      // solo existe en la cuenta de esa persona, así que "la otra parte" es
      // inequívoca sin necesitar el id del viewer actual.
      debt: transaction.debt
        ? {
            id: transaction.debt.id,
            counterpartyName:
              (transaction.debt.creditorId === transaction.createdByUserId
                ? transaction.debt.debtor?.name
                : transaction.debt.creditor?.name) ??
              transaction.debt.counterpartyName ??
              '',
          }
        : null,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  static toResponseList(transactions: TransactionWithRelations[]): TransactionResponseDto[] {
    return transactions.map(TransactionMapper.toResponse);
  }
}
