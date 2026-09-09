import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DebtPaymentStatus, DebtStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { DebtsRepository } from './debts.repository';
import { DebtMapper, DebtWithParties } from './mappers/debt.mapper';
import { DebtResponseDto } from './dto/debt-response.dto';
import { CreateDebtDto, DebtDirection } from './dto/create-debt.dto';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';

@Injectable()
export class DebtsService {
  constructor(
    private readonly debtsRepository: DebtsRepository,
    private readonly usersService: UsersService,
  ) {}

  async findAllForUser(userId: string): Promise<DebtResponseDto[]> {
    const debts = await this.debtsRepository.findAllForUser(userId);
    return DebtMapper.toResponseList(debts, userId);
  }

  async findOne(userId: string, id: string): Promise<DebtResponseDto> {
    const debt = await this.getAccessibleDebt(userId, id);
    return DebtMapper.toResponse(debt, userId);
  }

  async create(userId: string, dto: CreateDebtDto): Promise<DebtResponseDto> {
    const counterparty = await this.usersService.findByEmail(dto.counterpartyEmail);
    if (!counterparty) {
      throw new NotFoundException('No existe un usuario registrado con ese email');
    }
    if (counterparty.id === userId) {
      throw new BadRequestException('No puedes crear una deuda contigo mismo');
    }

    const creditorId = dto.direction === DebtDirection.THEY_OWE_ME ? userId : counterparty.id;
    const debtorId = dto.direction === DebtDirection.THEY_OWE_ME ? counterparty.id : userId;

    const created = await this.debtsRepository.create({
      creditorId,
      debtorId,
      createdByUserId: userId,
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
    });
    return DebtMapper.toResponse(created, userId);
  }

  // amount omitido = abonar el saldo pendiente completo (equivale a lo que
  // antes era "marcar como pagada", pero pasando por la misma confirmación
  // por-abono que cualquier otro pago parcial).
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

    await this.debtsRepository.createPayment({
      debtId: id,
      amount,
      note: dto.note,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      createdByUserId: userId,
    });

    const updated = await this.debtsRepository.findById(id);
    return DebtMapper.toResponse(updated!, userId);
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

    const updated = await this.debtsRepository.resolvePayment(
      id,
      paymentId,
      DebtPaymentStatus.CONFIRMED,
      Number(payment.amount),
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
