import { Debt } from '@prisma/client';
import { DebtResponseDto } from '../dto/debt-response.dto';
import { DebtDirection } from '../dto/create-debt.dto';

type UserSummary = { id: string; name: string; email: string };

export type DebtWithParties = Debt & { creditor: UserSummary; debtor: UserSummary };

export class DebtMapper {
  static toResponse(debt: DebtWithParties, viewerId: string): DebtResponseDto {
    const isCreditor = debt.creditorId === viewerId;
    const counterparty = isCreditor ? debt.debtor : debt.creditor;

    return {
      id: debt.id,
      counterparty,
      direction: isCreditor ? DebtDirection.THEY_OWE_ME : DebtDirection.I_OWE_THEM,
      amount: Number(debt.amount),
      currency: debt.currency,
      description: debt.description,
      status: debt.status,
      markedPaidByMe: debt.markedPaidByUserId === viewerId,
      createdByMe: debt.createdByUserId === viewerId,
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
      settledAt: debt.settledAt,
    };
  }

  static toResponseList(debts: DebtWithParties[], viewerId: string): DebtResponseDto[] {
    return debts.map((debt) => DebtMapper.toResponse(debt, viewerId));
  }
}
