import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { LoansRepository } from './loans.repository';
import { LoanMapper, LoanWithAccount } from './mappers/loan.mapper';
import { LoanResponseDto } from './dto/loan-response.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { PayLoanDto } from './dto/pay-loan.dto';
import { CurrencyCode } from '../common/currency';

const DEFAULT_CURRENCY = CurrencyCode.COP;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class LoansService {
  constructor(
    private readonly loansRepository: LoansRepository,
    private readonly accountsService: AccountsService,
  ) {}

  async findAllForUser(userId: string): Promise<LoanResponseDto[]> {
    const loans = await this.loansRepository.findAllForUser(userId);
    return LoanMapper.toResponseList(loans);
  }

  async findOne(userId: string, id: string): Promise<LoanResponseDto> {
    const loan = await this.getOwnedLoan(userId, id);
    return LoanMapper.toResponse(loan);
  }

  async create(userId: string, dto: CreateLoanDto): Promise<LoanResponseDto> {
    // Igual que Goal: si el préstamo está ligado a una cuenta, hereda su
    // moneda; si no, usa la que eligió el usuario o COP por default.
    let currency: string = dto.currency ?? DEFAULT_CURRENCY;
    if (dto.accountId) {
      const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
      currency = account.currency;
    }
    const created = await this.loansRepository.create({
      userId,
      name: dto.name,
      principal: dto.principal,
      currency,
      interestRate: dto.interestRate,
      installmentsTotal: dto.installmentsTotal,
      installmentAmount: dto.installmentAmount,
      dueDay: dto.dueDay,
      accountId: dto.accountId,
    });
    return LoanMapper.toResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateLoanDto): Promise<LoanResponseDto> {
    await this.getOwnedLoan(userId, id);
    const updated = await this.loansRepository.update(id, dto);
    return LoanMapper.toResponse(updated);
  }

  async pay(userId: string, id: string, dto: PayLoanDto): Promise<LoanResponseDto> {
    const loan = await this.getOwnedLoan(userId, id);
    if (loan.status === 'PAID_OFF') {
      throw new ConflictException('Este préstamo ya está pagado por completo');
    }

    const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    if (account.currency !== loan.currency) {
      throw new BadRequestException(
        `La cuenta debe estar en ${loan.currency} — el préstamo está en esa moneda`,
      );
    }

    const remaining = Number(loan.remainingBalance);
    const requested = dto.amount ?? Number(loan.installmentAmount);
    // La última cuota puede ser menor que installmentAmount — nunca se paga
    // de más ni queda remainingBalance negativo.
    const amount = Math.min(requested, remaining);
    const newRemaining = round2(remaining - amount);

    const updated = await this.loansRepository.registerPayment({
      loanId: id,
      accountId: dto.accountId,
      userId,
      amount,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      remainingBalance: newRemaining,
      status: newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE',
    });
    return LoanMapper.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedLoan(userId, id);
    await this.loansRepository.delete(id);
  }

  private async getOwnedLoan(userId: string, id: string): Promise<LoanWithAccount> {
    const loan = await this.loansRepository.findById(id);
    if (!loan || loan.userId !== userId) {
      throw new NotFoundException(`Préstamo ${id} no encontrado`);
    }
    return loan;
  }
}
