import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { LoansRepository } from './loans.repository';
import { LoanMapper, LoanWithAccount } from './mappers/loan.mapper';
import { LoanResponseDto } from './dto/loan-response.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { PayLoanDto } from './dto/pay-loan.dto';
import { CurrencyCode } from '../common/currency';
import {
  monthlyRateFromAnnualEffective,
  projectRemainingBalance,
  round2,
  splitNextInstallment,
} from './amortization.util';

const DEFAULT_CURRENCY = CurrencyCode.COP;

function formatCop(value: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    value,
  );
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

    const installmentsPaid = dto.installmentsPaid ?? 0;
    if (installmentsPaid > dto.installmentsTotal) {
      throw new BadRequestException('Las cuotas ya pagadas no pueden ser más que el total de cuotas');
    }
    const insurance = dto.insuranceAmount ?? 0;
    const monthlyRate = monthlyRateFromAnnualEffective(dto.interestRate);
    const fixedPortion = this.assertInstallmentCoversPlan(
      dto.installmentAmount,
      insurance,
      monthlyRate,
      dto.principal,
    );

    // Para importar un préstamo que ya viene en curso: solo se contabiliza lo
    // que sigue pendiente hoy, sin generar movimientos por las cuotas pasadas.
    // El saldo exacto del extracto manda; si no viene, se proyecta con la
    // amortización (con tasa 0 degenera al viejo principal − cuotas × valor).
    if (dto.remainingBalance !== undefined && dto.remainingBalance > dto.principal) {
      throw new BadRequestException('El saldo pendiente no puede ser mayor que el monto original');
    }
    const remainingBalance =
      dto.remainingBalance !== undefined
        ? round2(dto.remainingBalance)
        : projectRemainingBalance(dto.principal, monthlyRate, fixedPortion, installmentsPaid);

    const created = await this.loansRepository.create({
      userId,
      name: dto.name,
      principal: dto.principal,
      remainingBalance,
      currency,
      interestRate: dto.interestRate,
      installmentsTotal: dto.installmentsTotal,
      installmentsPaid,
      installmentAmount: dto.installmentAmount,
      insuranceAmount: dto.insuranceAmount,
      dueDay: dto.dueDay,
      accountId: dto.accountId,
      status: remainingBalance <= 0 ? 'PAID_OFF' : 'ACTIVE',
    });
    return LoanMapper.toResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateLoanDto): Promise<LoanResponseDto> {
    const loan = await this.getOwnedLoan(userId, id);

    const installmentAmount = dto.installmentAmount ?? Number(loan.installmentAmount);
    const insurance = dto.insuranceAmount ?? Number(loan.insuranceAmount ?? 0);
    const interestRate = dto.interestRate ?? (loan.interestRate === null ? undefined : Number(loan.interestRate));
    const remainingBalance = dto.remainingBalance ?? Number(loan.remainingBalance);
    if (remainingBalance > Number(loan.principal)) {
      throw new BadRequestException('El saldo pendiente no puede ser mayor que el monto original');
    }
    this.assertInstallmentCoversPlan(
      installmentAmount,
      insurance,
      monthlyRateFromAnnualEffective(interestRate),
      remainingBalance,
    );

    // Ajustar el saldo puede cerrar (saldo 0) o reabrir un préstamo ya pagado.
    const status =
      dto.remainingBalance === undefined ? undefined : dto.remainingBalance <= 0 ? 'PAID_OFF' : 'ACTIVE';
    const updated = await this.loansRepository.update(id, { ...dto, status });
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
    const insurance = Number(loan.insuranceAmount ?? 0);
    const monthlyRate = monthlyRateFromAnnualEffective(
      loan.interestRate === null ? null : Number(loan.interestRate),
    );
    const fixedPortion = Math.max(0, Number(loan.installmentAmount) - insurance);
    const plan = splitNextInstallment(remaining, monthlyRate, fixedPortion, insurance);

    // El total que sale de la cuenta es lo que el usuario pagó de verdad
    // (default: la próxima cuota del plan, ya recortada al saldo si es la
    // última). Lo que baja el saldo es SOLO el capital: primero se cubre el
    // interés del período y el seguro, el resto amortiza. Si el extracto dice
    // otro reparto (o es un abono extraordinario a capital), principalAmount
    // manda.
    const amount = round2(dto.amount ?? plan.total);
    if (amount <= 0) {
      throw new BadRequestException('El préstamo no tiene saldo pendiente por pagar');
    }
    const principal = round2(
      Math.min(remaining, Math.max(0, dto.principalAmount ?? amount - plan.interest - insurance)),
    );
    if (principal > amount) {
      throw new BadRequestException('El abono a capital no puede superar el total pagado');
    }
    const interest = round2(Math.max(0, amount - principal - insurance));
    const newRemaining = round2(remaining - principal);
    await this.accountsService.assertSufficientFunds(userId, dto.accountId, amount);

    const parts = [
      `capital ${formatCop(principal, loan.currency)}`,
      interest > 0 ? `interés ${formatCop(interest, loan.currency)}` : null,
      insurance > 0 ? `seguro ${formatCop(Math.min(insurance, amount - principal), loan.currency)}` : null,
    ].filter(Boolean);
    const note = `Cuota ${loan.installmentsPaid + 1}/${loan.installmentsTotal} · ${parts.join(' · ')}`;

    const updated = await this.loansRepository.registerPayment({
      loanId: id,
      accountId: dto.accountId,
      userId,
      amount,
      note,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      remainingBalance: newRemaining,
      status: newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE',
    });
    return LoanMapper.toResponse(updated);
  }

  // Devuelve la parte constante de la cuota (capital + interés). Rechaza un
  // plan que nunca amortiza: cuota ≤ seguro, o cuota que no alcanza a cubrir
  // el interés del primer período — casi siempre es que se tecleó la tasa
  // mensual como si fuera anual, o el valor de la cuota sin el seguro.
  private assertInstallmentCoversPlan(
    installmentAmount: number,
    insurance: number,
    monthlyRate: number,
    balance: number,
  ): number {
    const fixedPortion = round2(installmentAmount - insurance);
    if (fixedPortion <= 0) {
      throw new BadRequestException('El valor de la cuota debe ser mayor que el seguro / cargos fijos');
    }
    if (balance > 0 && fixedPortion <= round2(balance * monthlyRate)) {
      throw new BadRequestException(
        `Con esa tasa, la cuota no alcanza a cubrir los intereses del período (${formatCop(
          round2(balance * monthlyRate),
          'COP',
        )}). Revisa que la tasa sea efectiva ANUAL y que la cuota sea el valor total que cobra el banco`,
      );
    }
    return fixedPortion;
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
