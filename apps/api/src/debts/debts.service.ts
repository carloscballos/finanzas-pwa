import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DebtPaymentStatus, DebtStatus, TransactionType } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { AccountsService } from '../accounts/accounts.service';
import { DebtsRepository, DebtPaymentTransactionInfo } from './debts.repository';
import { DebtMapper, DebtWithParties } from './mappers/debt.mapper';
import { DebtResponseDto } from './dto/debt-response.dto';
import { CreateDebtDto, DebtDirection } from './dto/create-debt.dto';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';

@Injectable()
export class DebtsService {
  constructor(
    private readonly debtsRepository: DebtsRepository,
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
  ) {}

  async findAllForUser(userId: string): Promise<DebtResponseDto[]> {
    const debts = await this.debtsRepository.findAllForUser(userId);
    return DebtMapper.toResponseList(debts, userId);
  }

  async findOne(userId: string, id: string): Promise<DebtResponseDto> {
    const debt = await this.getAccessibleDebt(userId, id);
    return DebtMapper.toResponse(debt, userId);
  }

  // El email es opcional: si se da y coincide con un usuario registrado, la
  // deuda queda vinculada a su cuenta (abonos con confirmación cruzada,
  // igual que siempre). Si no se da, o no coincide con nadie, la deuda se
  // crea igual con counterpartyName/Email como texto libre — sin cuenta que
  // confirme, sus abonos se autoconfirman (ver registerPayment).
  async create(userId: string, dto: CreateDebtDto): Promise<DebtResponseDto> {
    let counterpartyUserId: string | null = null;
    if (dto.counterpartyEmail) {
      const counterparty = await this.usersService.findByEmail(dto.counterpartyEmail);
      if (counterparty) {
        if (counterparty.id === userId) {
          throw new BadRequestException('No puedes crear una deuda contigo mismo');
        }
        counterpartyUserId = counterparty.id;
      }
    }

    const creditorId = dto.direction === DebtDirection.THEY_OWE_ME ? userId : counterpartyUserId;
    const debtorId = dto.direction === DebtDirection.THEY_OWE_ME ? counterpartyUserId : userId;

    const created = await this.debtsRepository.create({
      creditorId,
      debtorId,
      // El nombre/email libres solo importan cuando NO hay usuario
      // vinculado — si lo hay, su nombre real ya viene de la relación.
      counterpartyName: counterpartyUserId ? null : dto.counterpartyName,
      counterpartyEmail: counterpartyUserId ? null : (dto.counterpartyEmail ?? null),
      createdByUserId: userId,
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
    });
    return DebtMapper.toResponse(created, userId);
  }

  // amount omitido = abonar el saldo pendiente completo (equivale a lo que
  // antes era "marcar como pagada", pero pasando por la misma confirmación
  // por-abono que cualquier otro pago parcial). accountId es la cuenta de
  // quien registra el abono — se refleja en su saldo (INCOME si es
  // acreedor, EXPENSE si es deudor) cuando el abono quede confirmado. Si la
  // contraparte no tiene cuenta en la app, no hay quién confirme, así que el
  // abono se autoconfirma de una vez.
  async registerPayment(userId: string, id: string, dto: CreateDebtPaymentDto): Promise<DebtResponseDto> {
    const debt = await this.getAccessibleDebt(userId, id);
    if (debt.status === DebtStatus.SETTLED) {
      throw new ConflictException('Esta deuda ya está liquidada');
    }

    const remaining = Number(debt.remainingBalance);
    const amount = dto.amount ?? remaining;
    if (amount > remaining) {
      throw new BadRequestException('El abono no puede superar el saldo pendiente');
    }

    const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    if (account.currency !== debt.currency) {
      throw new BadRequestException(`La cuenta debe estar en ${debt.currency} — la deuda está en esa moneda`);
    }

    const isCreditor = debt.creditorId === userId;
    const counterpartyUserId = isCreditor ? debt.debtorId : debt.creditorId;
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    // Solo el deudor saca dinero de su cuenta al abonar (el acreedor lo
    // recibe). Se valida aquí, al registrar: en abonos con confirmación
    // cruzada el movimiento se crea recién al confirmar, pero quien confirma
    // es la contraparte y no podría hacer nada con un "saldo insuficiente"
    // de una cuenta ajena — se asume que el saldo no cambió en el medio.
    if (!isCreditor) {
      await this.accountsService.assertSufficientFunds(userId, dto.accountId, amount);
    }
    const txInfo: DebtPaymentTransactionInfo = {
      accountId: dto.accountId,
      type: isCreditor ? TransactionType.INCOME : TransactionType.EXPENSE,
      createdByUserId: userId,
      occurredAt,
    };

    const updated = await this.debtsRepository.createPayment(
      {
        debtId: id,
        accountId: dto.accountId,
        amount,
        note: dto.note,
        occurredAt,
        createdByUserId: userId,
      },
      counterpartyUserId ? null : txInfo,
    );

    return DebtMapper.toResponse(updated, userId);
  }

  async confirmPayment(userId: string, id: string, paymentId: string): Promise<DebtResponseDto> {
    const debt = await this.getAccessibleDebt(userId, id);
    if (debt.status === DebtStatus.SETTLED) {
      throw new ConflictException('Esta deuda ya está liquidada');
    }
    const payment = this.getPendingPayment(debt, paymentId);
    if (payment.createdByUserId === userId) {
      throw new ForbiddenException('No puedes confirmar tu propio abono; debe hacerlo la otra persona');
    }

    // Quien registró el abono es siempre la otra parte en este punto (ya se
    // descartó arriba que sea quien confirma) — se determina si esa persona
    // era el acreedor o el deudor para saber si el Transaction es un
    // ingreso o un gasto en SU cuenta.
    const creatorIsCreditor = payment.createdByUserId === debt.creditorId;
    const confirmTx: DebtPaymentTransactionInfo | null = payment.accountId
      ? {
          accountId: payment.accountId,
          type: creatorIsCreditor ? TransactionType.INCOME : TransactionType.EXPENSE,
          createdByUserId: payment.createdByUserId,
          occurredAt: payment.occurredAt,
        }
      : null;

    const updated = await this.debtsRepository.resolvePayment(
      id,
      paymentId,
      DebtPaymentStatus.CONFIRMED,
      Number(payment.amount),
      confirmTx,
    );
    return DebtMapper.toResponse(updated, userId);
  }

  async rejectPayment(userId: string, id: string, paymentId: string): Promise<DebtResponseDto> {
    const debt = await this.getAccessibleDebt(userId, id);
    const payment = this.getPendingPayment(debt, paymentId);
    if (payment.createdByUserId === userId) {
      throw new ForbiddenException('No puedes rechazar tu propio abono; debe hacerlo la otra persona');
    }

    const updated = await this.debtsRepository.resolvePayment(id, paymentId, DebtPaymentStatus.REJECTED);
    return DebtMapper.toResponse(updated, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    const debt = await this.getAccessibleDebt(userId, id);
    if (debt.createdByUserId !== userId) {
      throw new ForbiddenException('Solo quien creó la deuda puede eliminarla');
    }
    if (debt.status !== DebtStatus.PENDING) {
      throw new ConflictException('No puedes eliminar una deuda que ya está liquidada');
    }
    await this.debtsRepository.delete(id);
  }

  // Cuenta inexistente y deuda ajena se tratan igual (404) para no revelar
  // deudas de terceros.
  private async getAccessibleDebt(userId: string, id: string): Promise<DebtWithParties> {
    const debt = await this.debtsRepository.findById(id);
    if (!debt || (debt.creditorId !== userId && debt.debtorId !== userId)) {
      throw new NotFoundException(`Deuda ${id} no encontrada`);
    }
    return debt;
  }

  private getPendingPayment(debt: DebtWithParties, paymentId: string) {
    const payment = debt.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new NotFoundException(`Abono ${paymentId} no encontrado`);
    }
    if (payment.status !== DebtPaymentStatus.PENDING_CONFIRMATION) {
      throw new ConflictException('Este abono ya fue confirmado o rechazado');
    }
    return payment;
  }
}
