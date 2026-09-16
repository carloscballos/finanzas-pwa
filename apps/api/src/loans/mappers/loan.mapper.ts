import { Loan } from '@prisma/client';
import { LoanResponseDto } from '../dto/loan-response.dto';
import { monthlyRateFromAnnualEffective, splitNextInstallment } from '../amortization.util';

export type LoanWithAccount = Loan & { account: { id: string; name: string } | null };

export class LoanMapper {
  static toResponse(loan: LoanWithAccount): LoanResponseDto {
    const principal = Number(loan.principal);
    const remainingBalance = Number(loan.remainingBalance);
    const interestRate = loan.interestRate === null ? null : Number(loan.interestRate);
    const insuranceAmount = loan.insuranceAmount === null ? null : Number(loan.insuranceAmount);
    const monthlyRate = monthlyRateFromAnnualEffective(interestRate);
    const fixedPortion = Math.max(0, Number(loan.installmentAmount) - (insuranceAmount ?? 0));

    return {
      id: loan.id,
      name: loan.name,
      principal,
      remainingBalance,
      currency: loan.currency,
      interestRate,
      monthlyRate: Math.round(monthlyRate * 100 * 10000) / 10000,
      installmentsTotal: loan.installmentsTotal,
      installmentsPaid: loan.installmentsPaid,
      installmentAmount: Number(loan.installmentAmount),
      insuranceAmount,
      nextInstallment:
        loan.status === 'PAID_OFF' || remainingBalance <= 0
          ? null
          : splitNextInstallment(remainingBalance, monthlyRate, fixedPortion, insuranceAmount ?? 0),
      dueDay: loan.dueDay,
      account: loan.account,
      status: loan.status,
      // Puede dar negativo si el usuario ajustó el saldo por encima del
      // principal (ej. intereses capitalizados) — se clampea a 0.
      percentPaid:
        principal > 0 ? Math.max(0, Math.round(((principal - remainingBalance) / principal) * 100)) : 0,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
    };
  }

  static toResponseList(loans: LoanWithAccount[]): LoanResponseDto[] {
    return loans.map(LoanMapper.toResponse);
  }
}
