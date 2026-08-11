import { RecurringTransaction, TransactionType } from '@prisma/client';
import { RecurringTransactionResponseDto } from '../dto/recurring-transaction-response.dto';

export type RecurringTransactionWithRelations = RecurringTransaction & {
  account: { id: string; name: string; currency: string };
  category: { id: string; name: string; emoji: string | null; type: TransactionType };
};

export class RecurringTransactionMapper {
  static toResponse(rt: RecurringTransactionWithRelations): RecurringTransactionResponseDto {
    return {
      id: rt.id,
      account: rt.account,
      category: rt.category,
      type: rt.type,
      amount: Number(rt.amount),
      note: rt.note,
      frequency: rt.frequency,
      active: rt.active,
      lastAppliedAt: rt.lastAppliedAt,
      createdAt: rt.createdAt,
      updatedAt: rt.updatedAt,
    };
  }

  static toResponseList(items: RecurringTransactionWithRelations[]): RecurringTransactionResponseDto[] {
    return items.map(RecurringTransactionMapper.toResponse);
  }
}
