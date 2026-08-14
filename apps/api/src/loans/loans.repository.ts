import { Injectable } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { LoanWithAccount } from './mappers/loan.mapper';

const WITH_ACCOUNT = { account: { select: { id: true, name: true } } } as const;

export interface CreateLoanRecord {
  userId: string;
  name: string;
  principal: number;
  remainingBalance: number;
  currency: string;
  interestRate?: number;
  installmentsTotal: number;
  installmentsPaid: number;
  installmentAmount: number;
  dueDay?: number;
  accountId?: string;
  status: LoanStatus;
}

export interface RegisterPaymentInput {
  loanId: string;
  accountId: string;
  userId: string;
  amount: number;
  occurredAt: Date;
  remainingBalance: number;
  status: LoanStatus;
}

@Injectable()
export class LoansRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<LoanWithAccount[]> {
    return this.prisma.loan.findMany({
      where: { userId },
      include: WITH_ACCOUNT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<LoanWithAccount | null> {
    return this.prisma.loan.findUnique({ where: { id }, include: WITH_ACCOUNT });
  }

  create(data: CreateLoanRecord): Promise<LoanWithAccount> {
    return this.prisma.loan.create({
      data: {
        userId: data.userId,
        name: data.name,
        principal: data.principal,
        remainingBalance: data.remainingBalance,
        currency: data.currency,
        interestRate: data.interestRate,
        installmentsTotal: data.installmentsTotal,
        installmentsPaid: data.installmentsPaid,
        installmentAmount: data.installmentAmount,
        dueDay: data.dueDay,
        accountId: data.accountId,
        status: data.status,
      },
      include: WITH_ACCOUNT,
    });
  }

  update(id: string, dto: UpdateLoanDto): Promise<LoanWithAccount> {
    return this.prisma.loan.update({
      where: { id },
      data: {
        name: dto.name,
        interestRate: dto.interestRate,
        dueDay: dto.dueDay,
      },
      include: WITH_ACCOUNT,
    });
  }

  // Transacción interactiva: crea el Transaction real del pago y actualiza
  // remainingBalance/installmentsPaid/status de forma atómica — mismo
  // principio que GoalsRepository.addContribution y TransfersRepository.create.
  async registerPayment(input: RegisterPaymentInput): Promise<LoanWithAccount> {
    const loanId = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          accountId: input.accountId,
          type: 'EXPENSE',
          amount: input.amount,
          occurredAt: input.occurredAt,
          createdByUserId: input.userId,
          loanId: input.loanId,
        },
      });
      const loan = await tx.loan.update({
        where: { id: input.loanId },
        data: {
          remainingBalance: input.remainingBalance,
          installmentsPaid: { increment: 1 },
          status: input.status,
        },
      });
      return loan.id;
    });

    return (await this.findById(loanId))!;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.loan.delete({ where: { id } });
  }
}
