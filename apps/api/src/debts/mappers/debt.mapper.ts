import { Debt, DebtPayment } from '@prisma/client';
import { DebtResponseDto } from '../dto/debt-response.dto';
import { DebtPaymentResponseDto } from '../dto/debt-payment-response.dto';
import { DebtDirection } from '../dto/create-debt.dto';

type UserSummary = { id: string; name: string; email: string };

export type DebtWithParties = Debt & {
  creditor: UserSummary | null;
  debtor: UserSummary | null;
  payments: DebtPayment[];
};

export class DebtMapper {
  static toResponse(debt: DebtWithParties, viewerId: string): DebtResponseDto {
    const isCreditor = debt.creditorId === viewerId;
    const counterpartyUser = isCreditor ? debt.debtor : debt.creditor;
    const amount = Number(debt.amount);
    const remainingBalance = Number(debt.remainingBalance);

    return {
      id: debt.id,
      counterparty: counterpartyUser
        ? { id: counterpartyUser.id, name: counterpartyUser.name, email: counterpartyUser.email, isRegistered: true }
        : { id: null, name: debt.counterpartyName ?? '(sin nombre)', email: debt.counterpartyEmail, isRegistered: false },
      direction: isCreditor ? DebtDirection.THEY_OWE_ME : DebtDirection.I_OWE_THEM,
      amount,
      remainingBalance,
      percentPaid: amount > 0 ? Math.round(((amount - remainingBalance) / amount) * 100) : 0,
      currency: debt.currency,
      description: debt.description,
      status: debt.status,
      createdByMe: debt.createdByUserId === viewerId,
      payments: debt.payments.map((payment) => DebtMapper.paymentToResponse(payment, viewerId)),
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
      settledAt: debt.settledAt,
    };
  }

  static toResponseList(debts: DebtWithParties[], viewerId: string): DebtResponseDto[] {
    return debts.map((debt) => DebtMapper.toResponse(debt, viewerId));
  }

  static paymentToResponse(payment: DebtPayment, viewerId: string): DebtPaymentResponseDto {
    return {
      id: payment.id,
      accountId: payment.accountId,
      amount: Number(payment.amount),
      note: payment.note,
      occurredAt: payment.occurredAt,
      status: payment.status,
      createdByMe: payment.createdByUserId === viewerId,
      createdAt: payment.createdAt,
    };
  }
}
