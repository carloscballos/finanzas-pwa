import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { DebtsRepository } from './debts.repository';
import { DebtMapper, DebtWithParties } from './mappers/debt.mapper';
import { DebtResponseDto } from './dto/debt-response.dto';
import { CreateDebtDto, DebtDirection } from './dto/create-debt.dto';

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

  async markPaid(userId: string, id: string): Promise<DebtResponseDto> {
    const debt = await this.getAccessibleDebt(userId, id);
    if (debt.status !== 'PENDING') {
      throw new ConflictException('Esta deuda ya fue marcada como pagada o ya está liquidada');
    }
    const updated = await this.debtsRepository.setStatus(id, {
      status: 'PAID_PENDING_CONFIRMATION',
      markedPaidByUserId: userId,
    });
    return DebtMapper.toResponse(updated, userId);
  }

  async confirm(userId: string, id: string): Promise<DebtResponseDto> {
    const debt = await this.getAccessibleDebt(userId, id);
    this.assertPendingConfirmationByOther(debt, userId);
    const updated = await this.debtsRepository.setStatus(id, {
      status: 'SETTLED',
      settledAt: new Date(),
    });
    return DebtMapper.toResponse(updated, userId);
  }

  async reject(userId: string, id: string): Promise<DebtResponseDto> {
    const debt = await this.getAccessibleDebt(userId, id);
    this.assertPendingConfirmationByOther(debt, userId);
    const updated = await this.debtsRepository.setStatus(id, {
      status: 'PENDING',
      markedPaidByUserId: null,
    });
    return DebtMapper.toResponse(updated, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    const debt = await this.getAccessibleDebt(userId, id);
    if (debt.createdByUserId !== userId) {
      throw new ForbiddenException('Solo quien creó la deuda puede eliminarla');
    }
    if (debt.status !== 'PENDING') {
      throw new ConflictException('No puedes eliminar una deuda que ya está en proceso de pago o liquidada');
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

  private assertPendingConfirmationByOther(debt: DebtWithParties, userId: string): void {
    if (debt.status !== 'PAID_PENDING_CONFIRMATION') {
      throw new ConflictException('Esta deuda no está esperando confirmación de pago');
    }
    if (debt.markedPaidByUserId === userId) {
      throw new ForbiddenException('No puedes confirmar tu propio aviso de pago; debe hacerlo la otra persona');
    }
  }
}
