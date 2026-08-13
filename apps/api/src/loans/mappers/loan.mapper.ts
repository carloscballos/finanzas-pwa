import { Loan } from '@prisma/client';
import { LoanResponseDto } from '../dto/loan-response.dto';

export type LoanWithAccount = Loan & { account: { id: string; name: string } | null };

export class LoanMapper {
  static toResponse(loan: LoanWithAccount): LoanResponseDto {
    const principal = Number(loan.principal);
    const remainingBalance = Number(loan.remainingBalance);

    return {
      id: loan.id,
      name: loan.name,
      principal,
      remainingBalance,
      currency: loan.currency,
      interestRate: loan.interestRate === null ? null : Number(loan.interestRate),
      installmentsTotal: loan.installmentsTotal,
      installmentsPaid: loan.installmentsPaid,
      installmentAmount: Number(loan.installmentAmount),
      dueDay: loan.dueDay,
      account: loan.account,
      status: loan.status,
      percentPaid:
        principal > 0 ? Math.round(((principal - remainingBalance) / principal) * 100) : 0,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
    };
  }

  static toResponseList(loans: LoanWithAccount[]): LoanResponseDto[] {
    return loans.map(LoanMapper.toResponse);
  }
}
