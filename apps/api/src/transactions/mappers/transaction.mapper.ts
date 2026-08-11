import { Transaction, TransactionType } from '@prisma/client';
import { TransactionResponseDto } from '../dto/transaction-response.dto';

export type TransactionWithRelations = Transaction & {
  account: { id: string; name: string; currency: string };
  category: { id: string; name: string; emoji: string | null; type: TransactionType };
};

export class TransactionMapper {
  static toResponse(transaction: TransactionWithRelations): TransactionResponseDto {
    return {
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      note: transaction.note,
      occurredAt: transaction.occurredAt,
      account: transaction.account,
      category: transaction.category,
      createdByUserId: transaction.createdByUserId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  static toResponseList(transactions: TransactionWithRelations[]): TransactionResponseDto[] {
    return transactions.map(TransactionMapper.toResponse);
  }
}
