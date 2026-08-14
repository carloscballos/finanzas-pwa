import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { CardPurchasesRepository } from './card-purchases.repository';
import { CardPurchaseMapper, CardPurchaseWithAccount } from './mappers/card-purchase.mapper';
import { CardPurchaseResponseDto } from './dto/card-purchase-response.dto';
import { CreateCardPurchaseDto } from './dto/create-card-purchase.dto';
import { UpdateCardPurchaseDto } from './dto/update-card-purchase.dto';
import { PayCardPurchaseInstallmentDto } from './dto/pay-card-purchase-installment.dto';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class CardPurchasesService {
  constructor(
    private readonly cardPurchasesRepository: CardPurchasesRepository,
    private readonly accountsService: AccountsService,
  ) {}

  async findAllForUser(userId: string): Promise<CardPurchaseResponseDto[]> {
    const purchases = await this.cardPurchasesRepository.findAllForUser(userId);
    return CardPurchaseMapper.toResponseList(purchases);
  }

  async findForAccount(userId: string, accountId: string): Promise<CardPurchaseResponseDto[]> {
    await this.accountsService.getAccessibleAccount(userId, accountId);
    const purchases = await this.cardPurchasesRepository.findForAccount(accountId);
    return CardPurchaseMapper.toResponseList(purchases);
  }

  async findOne(userId: string, id: string): Promise<CardPurchaseResponseDto> {
    const purchase = await this.getOwnedPurchase(userId, id);
    return CardPurchaseMapper.toResponse(purchase);
  }

  async create(userId: string, dto: CreateCardPurchaseDto): Promise<CardPurchaseResponseDto> {
    const account = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    if (account.type !== 'CREDIT_CARD') {
      throw new BadRequestException(
        'Solo se pueden registrar compras a cuotas en cuentas de tipo tarjeta de crédito',
      );
    }

    const installmentsPaid = dto.installmentsPaid ?? 0;
    if (installmentsPaid > dto.installmentsTotal) {
      throw new BadRequestException('Las cuotas ya pagadas no pueden ser más que el total de cuotas');
    }
    // Solo se contabiliza lo que sigue pendiente hoy — si se está importando
    // una compra que ya traía cuotas pagadas antes de usar la app, esas
    // cuotas pasadas no generan ningún movimiento nuevo.
    const remainingBalance = round2(
      Math.max(0, dto.amount - installmentsPaid * dto.installmentAmount),
    );

    const created = await this.cardPurchasesRepository.create({
      userId,
      accountId: dto.accountId,
      merchant: dto.merchant,
      amount: dto.amount,
      remainingBalance,
      installmentsTotal: dto.installmentsTotal,
      installmentsPaid,
      installmentAmount: dto.installmentAmount,
      purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
      status: remainingBalance <= 0 ? 'PAID_OFF' : 'ACTIVE',
    });
    return CardPurchaseMapper.toResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateCardPurchaseDto): Promise<CardPurchaseResponseDto> {
    await this.getOwnedPurchase(userId, id);
    const updated = await this.cardPurchasesRepository.update(id, dto);
    return CardPurchaseMapper.toResponse(updated);
  }

  async payInstallment(
    userId: string,
    id: string,
    dto: PayCardPurchaseInstallmentDto,
  ): Promise<CardPurchaseResponseDto> {
    const purchase = await this.getOwnedPurchase(userId, id);
    if (purchase.status === 'PAID_OFF') {
      throw new ConflictException('Esta compra ya está pagada por completo');
    }
    if (dto.accountId === purchase.accountId) {
      throw new BadRequestException('La cuenta de pago debe ser distinta a la tarjeta');
    }

    const payingAccount = await this.accountsService.getAccessibleAccount(userId, dto.accountId);
    if (payingAccount.currency !== purchase.account.currency) {
      throw new BadRequestException(
        `La cuenta debe estar en ${purchase.account.currency} — la tarjeta está en esa moneda`,
      );
    }

    const remaining = Number(purchase.remainingBalance);
    const requested = dto.amount ?? Number(purchase.installmentAmount);
    // La última cuota puede ser menor que installmentAmount — nunca se paga
    // de más ni queda remainingBalance negativo.
    const amount = Math.min(requested, remaining);
    const newRemaining = round2(remaining - amount);

    const updated = await this.cardPurchasesRepository.registerInstallmentPayment({
      cardPurchaseId: id,
      cardAccountId: purchase.accountId,
      payingAccountId: dto.accountId,
      userId,
      amount,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      remainingBalance: newRemaining,
      status: newRemaining <= 0 ? 'PAID_OFF' : 'ACTIVE',
    });
    return CardPurchaseMapper.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedPurchase(userId, id);
    await this.cardPurchasesRepository.delete(id);
  }

  private async getOwnedPurchase(userId: string, id: string): Promise<CardPurchaseWithAccount> {
    const purchase = await this.cardPurchasesRepository.findById(id);
    if (!purchase || purchase.userId !== userId) {
      throw new NotFoundException(`Compra ${id} no encontrada`);
    }
    return purchase;
  }
}
